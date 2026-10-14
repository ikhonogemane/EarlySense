from re import search
from django.db.models import Avg, Count, F
import anthropic
from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Avg, Count
from django.utils import timezone
from django.http import HttpResponse
from django.conf import settings
from .models import (
    User,
    Learner,
    AttendanceRecord,
    MarkRecord,
    Incident,
    RiskScore,
    Alert,
    Referral,
    AuditLog,
    Report,
)
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    LearnerSerializer,
    AttendanceRecordSerializer,
    MarkRecordSerializer,
    IncidentSerializer,
    RiskScoreSerializer,
    AlertSerializer,
    ReferralSerializer,
    AuditLogSerializer,
    ReportSerializer,
)
import csv
import io
import logging
import os
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

logger = logging.getLogger(__name__)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        AuditLog.objects.create(
            user=self.user,
            action="Login",
            target_type="User",
            target_id=self.user.id,
            ip_address=None,
        )
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    from django.db.models import OuterRef, Subquery

    # Each learner accumulates a NEW RiskScore row every time the ML engine
    # recomputes (CSV upload, attendance marked, etc.) rather than
    # overwriting the old one. Counting "any RiskScore at this level ever"
    # double-counts a learner who moved between risk levels over time —
    # which is why the totals didn't add up to Total Learners. Bucket by
    # each learner's MOST RECENT risk score only, so the counts are
    # mutually exclusive.
    latest_risk_subquery = (
        RiskScore.objects.filter(learner=OuterRef("pk"))
        .order_by("-computed_date")
        .values("risk_level")[:1]
    )

    learners = Learner.objects.filter(is_active=True).annotate(
        latest_risk_level=Subquery(latest_risk_subquery)
    )

    total = learners.count()
    high = learners.filter(latest_risk_level="High").count()
    medium = learners.filter(latest_risk_level="Medium").count()
    low = learners.filter(latest_risk_level="Low").count()
    unread_alerts = Alert.objects.filter(is_read=False).count()
    return Response(
        {
            "total_learners": total,
            "high_risk": high,
            "medium_risk": medium,
            "low_risk": low,
            "unread_alerts": unread_alerts,
        }
    )


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        # FR02, NFR16 stop-gap: only a System Administrator may create a
        # user account. This only gates POST — GET (the list) is
        # unchanged. The central permission layer will replace this
        # check later.
        if request.user.role != "System_Admin":
            return Response(
                {"error": "Only a System Administrator may create users."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="User_Created",
            target_type="User",
            target_id=user.id,
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


class LearnerListCreateView(generics.ListCreateAPIView):
    serializer_class = LearnerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Learner.objects.filter(is_active=True)
        user = self.request.user
        grade = self.request.query_params.get("grade")
        search = self.request.query_params.get("search")

        if user.role == "Educator":
            if user.assigned_grade and user.assigned_class_group:
                queryset = queryset.filter(
                    grade=user.assigned_grade, class_group=user.assigned_class_group
                )
            elif user.assigned_grade:
                queryset = queryset.filter(grade=user.assigned_grade)
            return queryset

        if grade:
            queryset = queryset.filter(grade=grade)
        if search:
            queryset = queryset.filter(first_name__icontains=search) | queryset.filter(
                surname__icontains=search
            )
        return queryset


class LearnerDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Learner.objects.all()
    serializer_class = LearnerSerializer
    permission_classes = [IsAuthenticated]


class AttendanceListCreateView(generics.ListCreateAPIView):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AttendanceRecord.objects.all()
        learner_id = self.request.query_params.get("learner_id")
        if learner_id:
            queryset = queryset.filter(learner_id=learner_id)
        return queryset


class MarkListCreateView(generics.ListCreateAPIView):
    serializer_class = MarkRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MarkRecord.objects.all()
        learner_id = self.request.query_params.get("learner_id")
        if learner_id:
            queryset = queryset.filter(learner_id=learner_id)
        return queryset


class IncidentListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Incident.objects.all()
        learner_id = self.request.query_params.get("learner_id")
        if learner_id:
            queryset = queryset.filter(learner_id=learner_id)
        return queryset


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]


class RiskScoreListView(generics.ListAPIView):
    serializer_class = RiskScoreSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = RiskScore.objects.all().order_by("-computed_date")
        risk_level = self.request.query_params.get("risk_level")
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        return queryset


class AlertListView(generics.ListAPIView):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Alert.objects.all().order_by("-created_at")

        # Educators only see alerts for their assigned class
        if user.role == "Educator":
            if user.assigned_grade and user.assigned_class_group:
                queryset = queryset.filter(
                    learner__grade=user.assigned_grade,
                    learner__class_group=user.assigned_class_group,
                )

        return queryset


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def educator_class_trends(request):
    """
    Aggregated attendance, mark, and incident data for the requesting
    Educator's own assigned class — used to power the Educator Dashboard
    charts. Returns empty series (not an error) if the educator isn't
    assigned to a class yet, or has no records logged.
    """
    user = request.user
    if not (user.assigned_grade and user.assigned_class_group):
        return Response(
            {"attendance_trend": [], "mark_trend": [], "incident_breakdown": []}
        )

    class_learners = Learner.objects.filter(
        is_active=True,
        grade=user.assigned_grade,
        class_group=user.assigned_class_group,
    )

    # Weekly attendance rate for the class, most recent 8 weeks.
    # Counting present vs total per ISO week manually (rather than a
    # conditional aggregate) keeps this readable and avoids DB-specific
    # boolean-aggregate quirks.
    weekly_totals = {}
    for record in AttendanceRecord.objects.filter(learner__in=class_learners):
        wk = record.date.isocalendar()[:2]  # (iso_year, iso_week)
        bucket = weekly_totals.setdefault(
            wk, {"present": 0, "total": 0, "date": record.date}
        )
        bucket["total"] += 1
        if record.is_present:
            bucket["present"] += 1
        if record.date < bucket["date"]:
            bucket["date"] = record.date

    attendance_trend = [
        {
            "week": v["date"].strftime("%d %b"),
            "rate": round((v["present"] / v["total"]) * 100, 1) if v["total"] else 0,
        }
        for k, v in sorted(weekly_totals.items())
    ][-8:]

    # Average mark % per assessment date, across the class, most recent 8
    from django.db.models import FloatField, ExpressionWrapper

    mark_qs = (
        MarkRecord.objects.filter(learner__in=class_learners)
        .annotate(
            pct=ExpressionWrapper(
                100.0 * F("mark") / F("max_mark"), output_field=FloatField()
            )
        )
        .values("assessment_date")
        .annotate(avg_pct=Avg("pct"))
        .order_by("assessment_date")
    )
    mark_trend = [
        {
            "date": (
                row["assessment_date"].strftime("%d %b")
                if row["assessment_date"]
                else "N/A"
            ),
            "average": round(row["avg_pct"] or 0, 1),
        }
        for row in mark_qs
    ][-8:]

    # Incident counts by type for the class
    incident_qs = (
        Incident.objects.filter(learner__in=class_learners)
        .values("incident_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    incident_breakdown = [
        {"type": row["incident_type"], "count": row["count"]} for row in incident_qs
    ]

    return Response(
        {
            "attendance_trend": attendance_trend,
            "mark_trend": mark_trend,
            "incident_breakdown": incident_breakdown,
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def mark_alert_read(request, pk):
    try:
        alert = Alert.objects.get(pk=pk)
        alert.is_read = True
        alert.save()
        return Response({"message": "Alert marked as read"})
    except Alert.DoesNotExist:
        return Response({"error": "Alert not found"}, status=404)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_alerts_read(request):
    Alert.objects.filter(is_read=False).update(is_read=True)
    return Response({"message": "All alerts marked as read"})


class ReferralListCreateView(generics.ListCreateAPIView):
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Referral.objects.all().order_by("-created_at")
        user = self.request.user
        if user.role == "LST_Member":
            queryset = queryset.filter(assigned_to=user)
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        referral = serializer.save(referred_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user,
            action="Referral_Created",
            target_type="Referral",
            target_id=referral.id,
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class ReferralDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Referral.objects.all()
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AuditLog.objects.all().order_by("-timestamp")


class ReportListCreateView(generics.ListCreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Report.objects.all().order_by("-generated_at")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_csv(request):
    file = request.FILES.get("file")
    upload_type = request.data.get("type", "attendance")

    if not file:
        return Response(
            {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
        )
    if not file.name.endswith(".csv"):
        return Response(
            {"error": "File must be a CSV"}, status=status.HTTP_400_BAD_REQUEST
        )

    decoded = file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    errors = []
    duplicates = 0

    for row_num, row in enumerate(reader, start=2):
        try:
            if upload_type == "learners":
                _, created = Learner.objects.get_or_create(
                    sasams_id=row.get("learner_id"),
                    defaults={
                        "first_name": row.get("first_name", ""),
                        "surname": row.get("surname", ""),
                        "grade": int(row.get("grade", 8)),
                        "class_group": row.get("class_group", ""),
                        "gender": row.get("gender", "Male"),
                        "date_of_birth": row.get("date_of_birth"),
                        "enrolled_date": row.get("enrolled_date"),
                        "home_town": row.get("home_town", ""),
                        "distance_km": float(row.get("distance_km", 0)),
                        "guardian_name": row.get("guardian_name", ""),
                        "guardian_phone": row.get("guardian_phone", ""),
                        "income_index": int(row.get("income_index", 2)),
                    },
                )
                if created:
                    imported += 1
                else:
                    duplicates += 1
                continue

            # For attendance and marks — find learner first
            learner = Learner.objects.filter(sasams_id=row.get("learner_id")).first()
            if not learner:
                errors.append(
                    f'Row {row_num}: Learner {row.get("learner_id")} not found'
                )
                continue

            learner = Learner.objects.filter(sasams_id=row.get("learner_id")).first()
            if not learner:
                errors.append(
                    f'Row {row_num}: Learner {row.get("learner_id")} not found'
                )
                continue

            # Educators can only upload for their assigned class
            if request.user.role == "Educator":
                if (
                    learner.grade != request.user.assigned_grade
                    or learner.class_group != request.user.assigned_class_group
                ):
                    errors.append(
                        f'Row {row_num}: Learner {row.get("learner_id")} is not in your assigned class'
                    )
                    continue

            if upload_type == "attendance":
                exists = AttendanceRecord.objects.filter(
                    learner=learner, date=row.get("date")
                ).exists()
                if exists:
                    duplicates += 1
                    continue
                AttendanceRecord.objects.create(
                    learner=learner,
                    date=row.get("date"),
                    is_present=row.get("present", "1") == "1",
                    recorded_by=request.user,
                )
                imported += 1

            elif upload_type == "marks":
                MarkRecord.objects.create(
                    learner=learner,
                    subject=row.get("subject"),
                    assessment_type=row.get("assessment_type", "Test"),
                    mark=float(row.get("mark", 0)),
                    max_mark=float(row.get("max_mark", 100)),
                    term=int(row.get("term", 1)),
                    assessment_date=row.get("assessment_date"),
                    recorded_by=request.user,
                )
                imported += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    AuditLog.objects.create(
        user=request.user,
        action="CSV_Upload",
        target_type="CSV",
        ip_address=request.META.get("REMOTE_ADDR"),
    )

    if imported > 0 and upload_type != "learners":
        try:
            from .ml_engine import predict_all_learners

            predict_all_learners()
        except Exception as e:
            print(f"ML prediction error: {e}")

        try:
            check_performance_decline()
        except Exception as e:
            print(f"Performance check error: {e}")

    return Response(
        {
            "imported": imported,
            "duplicates": duplicates,
            "errors": errors,
            "message": f"Successfully imported {imported} records",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_attendance(request):
    date = request.data.get("date")
    attendances = request.data.get("attendances", [])

    if not date or not attendances:
        return Response(
            {"error": "Date and attendances are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    created = 0
    updated = 0

    for item in attendances:
        learner_id = item.get("learner_id")
        is_present = item.get("is_present", True)
        try:
            learner = Learner.objects.get(id=learner_id)
            obj, was_created = AttendanceRecord.objects.update_or_create(
                learner=learner,
                date=date,
                defaults={
                    "is_present": is_present,
                    "recorded_by": request.user,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
        except Learner.DoesNotExist:
            continue

    AuditLog.objects.create(
        user=request.user,
        action="Attendance_Marked",
        target_type="AttendanceRecord",
        ip_address=request.META.get("REMOTE_ADDR"),
    )

    # Check for performance decline after marking
    try:
        check_performance_decline()
    except Exception as e:
        print(f"Performance check error: {e}")

    return Response(
        {
            "message": f"Attendance saved. {created} new, {updated} updated.",
            "created": created,
            "updated": updated,
        }
    )


# ─── PERFORMANCE DECLINE CHECK ───────────────────────────
def check_performance_decline():
    """
    Checks all learners for a 15% or more drop in average
    marks across consecutive assessments and creates alerts.
    """
    from django.db.models import Avg

    learners = Learner.objects.filter(is_active=True)

    for learner in learners:
        # Get marks ordered by date
        marks = learner.marks.order_by("assessment_date")
        if marks.count() < 2:
            continue

        # Split into two halves and compare averages
        total = marks.count()
        half = total // 2
        first_avg = marks[:half].aggregate(avg=Avg("mark"))["avg"] or 0
        last_avg = marks[half:].aggregate(avg=Avg("mark"))["avg"] or 0

        if first_avg == 0:
            continue

        decline = ((first_avg - last_avg) / first_avg) * 100

        if decline >= 15:
            # Check if alert already exists
            existing = Alert.objects.filter(
                learner=learner,
                alert_type="Performance",
                is_read=False,
            ).exists()

            if not existing:
                Alert.objects.create(
                    learner=learner,
                    alert_type="Performance",
                    message=(
                        f"{learner.first_name} {learner.surname} has shown a "
                        f"{decline:.1f}% decline in academic performance. "
                        f"Average dropped from {first_avg:.1f}% to {last_avg:.1f}%."
                    ),
                )
                print(
                    f"Performance alert created for {learner.first_name} {learner.surname}"
                )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_performance_check(request):
    try:
        check_performance_decline()
        return Response({"message": "Performance check complete"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def generate_report(request):
    report_type = request.query_params.get("type", "at_risk")
    file_format = request.query_params.get("format", "pdf")
    grade_filter = request.query_params.get("grade", "")

    learners = Learner.objects.filter(is_active=True)
    if grade_filter:
        learners = learners.filter(grade=grade_filter)

    report_data = []
    for learner in learners:
        latest_score = learner.risk_scores.order_by("-computed_date").first()
        attendance_count = learner.attendance.count()
        present_count = learner.attendance.filter(is_present=True).count()
        attendance_rate = (
            (present_count / attendance_count * 100) if attendance_count > 0 else 0
        )
        avg_mark = learner.marks.aggregate(avg=Avg("mark"))["avg"] or 0
        incidents = learner.incidents.count()

        report_data.append(
            {
                "name": f"{learner.first_name} {learner.surname}",
                "grade": learner.grade,
                "class": learner.class_group,
                "home_town": learner.home_town,
                "attendance_rate": round(attendance_rate, 1),
                "avg_mark": round(float(avg_mark), 1),
                "incidents": incidents,
                "risk_level": latest_score.risk_level if latest_score else "Unassessed",
                "risk_score": (
                    f"{latest_score.risk_score:.0%}" if latest_score else "N/A"
                ),
            }
        )

    if report_type == "at_risk":
        report_data = [r for r in report_data if r["risk_level"] in ["High", "Medium"]]
        report_data.sort(key=lambda x: 0 if x["risk_level"] == "High" else 1)

    AuditLog.objects.create(
        user=request.user,
        action="Report_Generated",
        target_type="Report",
        ip_address=request.META.get("REMOTE_ADDR"),
    )

    if file_format == "csv":
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="earlysense_{report_type}_report.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
                "Name",
                "Grade",
                "Class",
                "Home Town",
                "Attendance %",
                "Avg Mark %",
                "Incidents",
                "Risk Level",
                "Risk Score",
            ]
        )
        for row in report_data:
            writer.writerow(
                [
                    row["name"],
                    row["grade"],
                    row["class"],
                    row["home_town"],
                    row["attendance_rate"],
                    row["avg_mark"],
                    row["incidents"],
                    row["risk_level"],
                    row["risk_score"],
                ]
            )
        return response

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=60,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        "T",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#0f1923"),
        spaceAfter=6,
    )
    sub_style = ParagraphStyle(
        "S",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=20,
    )

    report_titles = {
        "at_risk": "At-Risk Learner Report",
        "attendance": "Attendance Summary Report",
        "intervention": "Intervention Outcomes Report",
    }

    story.append(
        Paragraph("EarlySense - AI-Driven Learner Retention System", title_style)
    )
    story.append(
        Paragraph(
            f'{report_titles.get(report_type, "Learner Report")} | '
            f'Generated: {timezone.now().strftime("%d %B %Y")} | '
            f"Generated by: {request.user.full_name}",
            sub_style,
        )
    )
    story.append(Spacer(1, 12))

    total = len(report_data)
    high = len([r for r in report_data if r["risk_level"] == "High"])
    medium = len([r for r in report_data if r["risk_level"] == "Medium"])

    summary_data = [
        ["Total Learners in Report", "High Risk", "Medium Risk"],
        [str(total), str(high), str(medium)],
    ]
    summary_table = Table(summary_data, colWidths=[160, 160, 160])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1923")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f9fafb")),
                ("FONTSIZE", (0, 1), (-1, 1), 16),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("ROWHEIGHT", (0, 0), (-1, -1), 30),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 20))

    table_data = [
        ["Name", "Grade", "Attendance", "Avg Mark", "Incidents", "Risk Level"]
    ]
    for row in report_data:
        table_data.append(
            [
                row["name"],
                f"Gr {row['grade']} {row['class']}",
                f"{row['attendance_rate']}%",
                f"{row['avg_mark']}%",
                str(row["incidents"]),
                row["risk_level"],
            ]
        )

    col_widths = [150, 70, 80, 80, 70, 70]
    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1923")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWHEIGHT", (0, 0), (-1, -1), 22),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        (
            "ROWBACKGROUNDS",
            (1, 1),
            (-1, -1),
            [colors.white, colors.HexColor("#f9fafb")],
        ),
    ]

    for i, row in enumerate(report_data, start=1):
        if row["risk_level"] == "High":
            table_styles.append(
                ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#dc2626"))
            )
            table_styles.append(("FONTNAME", (5, i), (5, i), "Helvetica-Bold"))
        elif row["risk_level"] == "Medium":
            table_styles.append(
                ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#d97706"))
            )
            table_styles.append(("FONTNAME", (5, i), (5, i), "Helvetica-Bold"))
        else:
            table_styles.append(
                ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#16a34a"))
            )

    main_table.setStyle(TableStyle(table_styles))
    story.append(main_table)
    story.append(Spacer(1, 20))

    footer_style = ParagraphStyle(
        "F", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#9ca3af")
    )
    story.append(
        Paragraph(
            "This report was generated by EarlySense - AI-Driven Learner Retention System. "
            "Sol Plaatje University, CSIT Department. Confidential - for authorised staff only.",
            footer_style,
        )
    )

    doc.build(story)
    buffer.seek(0)

    response = HttpResponse(buffer, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="earlysense_{report_type}_report.pdf"'
    )
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def run_generate_report(request):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
    )

    report_type = request.query_params.get("type", "at_risk")
    file_format = request.query_params.get("format", "pdf")
    grade_filter = request.query_params.get("grade", "")
    learners = Learner.objects.filter(is_active=True)
    if grade_filter:
        learners = learners.filter(grade=grade_filter)
    report_data = []
    for learner in learners:
        latest_score = learner.risk_scores.order_by("-computed_date").first()
        attendance_count = learner.attendance.count()
        present_count = learner.attendance.filter(is_present=True).count()
        attendance_rate = (
            (present_count / attendance_count * 100) if attendance_count > 0 else 0
        )
        avg_mark = learner.marks.aggregate(avg=Avg("mark"))["avg"] or 0
        incidents = learner.incidents.count()
        report_data.append(
            {
                "name": f"{learner.first_name} {learner.surname}",
                "grade": learner.grade,
                "class": learner.class_group,
                "home_town": learner.home_town,
                "attendance_rate": round(attendance_rate, 1),
                "avg_mark": round(float(avg_mark), 1),
                "incidents": incidents,
                "risk_level": latest_score.risk_level if latest_score else "Unassessed",
                "risk_score": (
                    f"{latest_score.risk_score:.0%}" if latest_score else "N/A"
                ),
            }
        )
    if report_type == "at_risk":
        report_data = [r for r in report_data if r["risk_level"] in ["High", "Medium"]]
        report_data.sort(key=lambda x: 0 if x["risk_level"] == "High" else 1)
    AuditLog.objects.create(
        user=request.user,
        action="Report_Generated",
        target_type="Report",
        ip_address=request.META.get("REMOTE_ADDR"),
    )
    if file_format == "csv":
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="earlysense_{file_format}_report.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
                "Name",
                "Grade",
                "Class",
                "Home Town",
                "Attendance %",
                "Avg Mark %",
                "Incidents",
                "Risk Level",
                "Risk Score",
            ]
        )
        for row in report_data:
            writer.writerow(
                [
                    row["name"],
                    row["grade"],
                    row["class"],
                    row["home_town"],
                    row["attendance_rate"],
                    row["avg_mark"],
                    row["incidents"],
                    row["risk_level"],
                    row["risk_score"],
                ]
            )
        return response
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=60,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()
    story = []
    title_style = ParagraphStyle(
        "T",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#0f1923"),
        spaceAfter=6,
    )
    sub_style = ParagraphStyle(
        "S",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=20,
    )
    report_titles = {
        "at_risk": "At-Risk Learner Report",
        "attendance": "Attendance Summary Report",
        "intervention": "Intervention Outcomes Report",
    }
    story.append(
        Paragraph("EarlySense - AI-Driven Learner Retention System", title_style)
    )
    story.append(
        Paragraph(
            f"{report_titles.get(report_type, 'Learner Report')} | Generated: {timezone.now().strftime('%d %B %Y')} | Generated by: {request.user.full_name}",
            sub_style,
        )
    )
    story.append(Spacer(1, 12))
    total = len(report_data)
    high = len([r for r in report_data if r["risk_level"] == "High"])
    medium = len([r for r in report_data if r["risk_level"] == "Medium"])
    summary_table = Table(
        [
            ["Total Learners", "High Risk", "Medium Risk"],
            [str(total), str(high), str(medium)],
        ],
        colWidths=[160, 160, 160],
    )
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1923")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("ROWHEIGHT", (0, 0), (-1, -1), 30),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 20))
    table_data = [
        ["Name", "Grade", "Attendance", "Avg Mark", "Incidents", "Risk Level"]
    ]
    for row in report_data:
        table_data.append(
            [
                row["name"],
                f"Gr {row['grade']}",
                f"{row['attendance_rate']}%",
                f"{row['avg_mark']}%",
                str(row["incidents"]),
                row["risk_level"],
            ]
        )
    main_table = Table(table_data, colWidths=[150, 70, 80, 80, 70, 70], repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1923")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWHEIGHT", (0, 0), (-1, -1), 22),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        (
            "ROWBACKGROUNDS",
            (1, 1),
            (-1, -1),
            [colors.white, colors.HexColor("#f9fafb")],
        ),
    ]
    for i, row in enumerate(report_data, start=1):
        if row["risk_level"] == "High":
            ts += [
                ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#dc2626")),
                ("FONTNAME", (5, i), (5, i), "Helvetica-Bold"),
            ]
        elif row["risk_level"] == "Medium":
            ts += [
                ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#d97706")),
                ("FONTNAME", (5, i), (5, i), "Helvetica-Bold"),
            ]
        else:
            ts.append(("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#16a34a")))
    main_table.setStyle(TableStyle(ts))
    story.append(main_table)
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            "EarlySense - Sol Plaatje University, CSIT. Confidential.",
            ParagraphStyle(
                "F",
                parent=styles["Normal"],
                fontSize=8,
                textColor=colors.HexColor("#9ca3af"),
            ),
        )
    )
    doc.build(story)
    buffer.seek(0)
    response = HttpResponse(buffer, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="earlysense_{report_type}_report.pdf"'
    )
    return response


# ─── AI SCRIPT ANALYSIS ──────────────────────────────────
def _sanitize_extracted_text(text):
    """
    PDF text extraction — even from well-behaved PDFs — can produce
    Unicode fraction ligatures, Private-Use-Area glyphs, or the raw
    replacement character when a PDF's embedded font uses a custom
    encoding the extractor can't resolve (common in Word-exported
    question papers with fraction formatting). Normalize what we can
    and strip anything else, so neither the LLM prompt nor the final
    report ever inherits a broken glyph.
    """
    vulgar_map = {
        "½": "1/2",
        "⅓": "1/3",
        "⅔": "2/3",
        "¼": "1/4",
        "¾": "3/4",
        "⅕": "1/5",
        "⅖": "2/5",
        "⅗": "3/5",
        "⅘": "4/5",
        "⅙": "1/6",
        "⅚": "5/6",
        "⅐": "1/7",
        "⅛": "1/8",
        "⅜": "3/8",
        "⅝": "5/8",
        "⅞": "7/8",
        "⅑": "1/9",
        "⅒": "1/10",
    }

    def _replace_vulgar(match):
        digit, frac = match.group(1), match.group(2)
        # add a space when glued onto a preceding digit, e.g. "2½" -> "2 1/2"
        return (f"{digit} " if digit else "") + vulgar_map[frac]

    text = re.sub(
        r"(\d)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])",
        _replace_vulgar,
        text,
    )
    # Strip anything we can't confidently map: other Number Forms glyphs,
    # Private-Use-Area characters, and the replacement character itself.
    text = re.sub(r"[\u2150-\u218F]", "", text)
    text = re.sub(r"[\uE000-\uF8FF]", "", text)
    text = re.sub(r"[\uFFF0-\uFFFF]", "", text)
    return text


def extract_pdf_text(f):
    """
    Extract text from an uploaded PDF. Tries pdfplumber first — it
    resolves embedded/custom font encodings (common in Word-exported
    PDFs with fraction ligatures) far more reliably than PyPDF2, which
    is prone to emitting garbled or unmapped glyphs for those specific
    characters. Falls back to PyPDF2 if pdfplumber fails for any reason.
    """
    text = ""
    try:
        import pdfplumber

        f.seek(0)
        with pdfplumber.open(f) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
    except Exception:
        import PyPDF2

        f.seek(0)
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() or ""

    return _sanitize_extracted_text(text.strip())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyse_script(request):
    from groq import APIError, Groq
    from google.genai import errors as genai_errors
    from dotenv import load_dotenv

    load_dotenv()

    learner_id = request.data.get("learner_id")
    subject = request.data.get("subject")
    assessment = request.data.get("assessment_name")
    script_file = request.FILES.get("script")
    memo_file = request.FILES.get("memo")
    qpaper_file = request.FILES.get("question_paper")

    if not all([learner_id, subject, assessment, script_file, memo_file, qpaper_file]):
        return Response(
            {"error": "Please provide all required fields and files"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        learner = Learner.objects.get(id=learner_id)
    except Learner.DoesNotExist:
        return Response({"error": "Learner not found"}, status=404)

    qpaper_text = extract_pdf_text(qpaper_file)
    memo_text   = extract_pdf_text(memo_file)

    print('\n' + '=' * 60)
    print('MEMO TEXT (as extracted, before analysis):')
    print('=' * 60)
    print(memo_text)
    print('=' * 60 + '\n')
    # The learner's script is handwritten, so it goes through vision-based
    # transcription rather than embedded-text extraction (which would
    # silently return nothing useful on a scanned handwritten page).
    try:
        script_text = transcribe_handwritten_script(script_file)
    except genai_errors.APIError as e:
        logger.exception('Gemini handwriting transcription call failed')
        if e.code in (429, 503):
            message = (
                'The handwriting-reading service is busy, please try '
                'again in a minute.'
            )
        else:
            message = (
                'The handwriting-reading service could not read the '
                'script. Please try again or contact the administrator.'
            )
        return Response({'error': message}, status=502)
    except Exception:
        logger.exception('Gemini handwriting transcription call failed')
        return Response(
            {
                'error': (
                    'Could not read the handwritten script. Please try '
                    'again or contact the administrator.'
                )
            },
            status=502,
        )
    
    # ── TEMPORARY DEBUG ──────────────────────────────────────────────
    # Prints exactly what Gemini read off the handwritten pages, before
    # it goes anywhere near the analysis prompt. Remove once we've
    # confirmed transcription quality is solid.
    print('\n' + '=' * 60)
    print('HANDWRITING TRANSCRIPT (raw, before analysis):')
    print('=' * 60)
    print(script_text)
    print('=' * 60 + '\n')
    # ─────────────────────────────────────────────────────────────────

    # Get learner context
    attendance_count = learner.attendance.count()
    present_count = learner.attendance.filter(is_present=True).count()
    attendance_rate = (
        (present_count / attendance_count * 100) if attendance_count > 0 else 0
    )
    latest_score = learner.risk_scores.order_by("-computed_date").first()
    risk_level = latest_score.risk_level if latest_score else "Unassessed"

    prompt = f"""You are an experienced educational psychologist and subject specialist helping a South African high school teacher understand exactly how a learner performed on an assessment — whether that performance was strong, weak, or mixed.

LEARNER CONTEXT:
- Name: {learner.first_name} {learner.surname}
- Grade: {learner.grade} — {learner.class_group}
- Subject: {subject}
- Assessment: {assessment}
- Attendance Rate: {attendance_rate:.1f}%
- AI Risk Level: {risk_level}
- Distance from school: {learner.distance_km} km
- Socioeconomic Index: {learner.income_index}/3

QUESTION PAPER:
{qpaper_text}

MARKING MEMO:
{memo_text}

LEARNER ANSWER SCRIPT:
{script_text}

## GRADING RULES — apply these while marking each question

1. **Marks**: Extract every sub-question's mark allocation from the memo. Your awarded marks must sum to the memo's stated total.
2. **Crossed-out work**: Completely ignore any [crossed out: ...] value. Use the final kept answer.
3. **Notation equivalence**: Before labeling anything as an equivalent format (scientific notation, unit variants), first convert both answers to a plain number and confirm they are numerically equal. If NOT equal, it's a genuine error, never a notation variant.
4. **Tolerance**: Accept calculated answers within ±2% of the memo's value (rounding). Bigger gaps are genuine errors.
5. **Method marks**: Award partial credit for a correct formula/approach even when the final answer is wrong.
6. **Diagnosis, not just a verdict — REQUIRED for every non-CORRECT answer, no matter how many there are**: Before writing the diagnosis, reconstruct the calculation yourself: work backward from the learner's answer to figure out which specific step produced it. Do not assume the error is in whichever operation comes last — check whether an earlier step, done wrong, would produce the learner's answer once the remaining correct steps are applied to it.
   - BAD (never do this, even under time/length pressure): "Incorrect subtraction." / "Incorrect LCM calculation." / "Incorrect conversion of decimal to fraction."
   - GOOD (required for EVERY question, whether there are 1 or 20 errors): "Added 345 + 678 incorrectly, getting 923 instead of 1023, before subtracting 213 correctly to reach 710." / "Listed multiples of 6 and 8 only, missing 12, and stopped at the first common multiple found (48) rather than the true lowest common multiple (24)."
   - This standard does NOT relax as the number of wrong answers increases. If a diagnosis is shorter than one full sentence, rewrite it.
7. **Classify what the mistake reveals — REQUIRED alongside every diagnosis in Rule 6**: After naming the mechanism, classify it as one of:
   - **Careless slip**: the correct method and understanding are clearly shown, but a small execution error (a copying mistake, a dropped digit, a sign flip) broke an otherwise correct process. Evidence: the working before/after the slip is sound.
   - **Conceptual gap**: the learner applied the wrong method or rule entirely — the working shows a genuine misunderstanding of what the question requires or how the concept works, not just an execution error.
   - **Foundational gap**: the error traces back to a more basic skill from an earlier grade/topic that this question depends on (e.g. a wrong algebra answer caused by an arithmetic error with negative numbers, not the algebra itself).
   - **Incomplete/no attempt**: too little working is shown to determine cause — say this plainly rather than guessing.
   - Justify the classification briefly using what's actually visible in the working (e.g. "careless slip — the method and every other step are correct, only the addition in step 1 is wrong" vs. "conceptual gap — the learner attempted to find a common denominator by multiplying denominators together without adjusting numerators, suggesting the underlying fraction-addition rule itself is not understood").
   - Do not default to "conceptual gap" for everything — a real careless slip should be named as such, since it needs a different kind of support than a genuine misunderstanding.
8. **Self-check**: After marking every question, add up your awarded marks and confirm the total matches the memo's stated total. Then scan back through every diagnosis you wrote — if any is a bare label rather than a full sentence naming the mechanism and its classification, rewrite it now, before writing Step 2.

## STEP 1 — Mark the script against the memo

Apply the rules above to every sub-question, in the order they appear in the memo. State the total as a score out of the paper's total (e.g. "28/30").

## STEP 2 — Now write the report, using ONLY the marking from Step 1 as your evidence base

Structure the report to match what Step 1 actually found — do not force every section to describe problems if the learner didn't have significant problems, and do not force praise if the learner struggled.

### 1. Performance Summary
State the score and what it indicates, specifically.

### 2. Mark Breakdown
List every sub-question with marks awarded/available exactly as in Step 1, then the total.

### 3. What the Learner Got Right
List CORRECT questions and what they demonstrate. Don't minimise this for a strong learner.

### 4. What the Learner Got Wrong (only if applicable)
For each PARTIALLY CORRECT / INCORRECT question, copy the specific diagnosis from Step 1 — the exact mechanism — AND its classification (careless slip / conceptual gap / foundational gap / incomplete attempt) with the brief justification. If none, say so plainly.

### 5. Conceptual Notes
Based on the classifications from Step 1: separate what's actually a knowledge gap from what's just carelessness — these need different support. Name specific mastered or unmastered concepts, and note if a pattern of foundational gaps is dragging down performance on the actual topic being tested.

### 6. Recommendations
3-5 specific next steps matching what Step 1 showed. Recommendations should differ by classification — careless slips need checking-habits/practice-under-time-pressure support, conceptual gaps need re-teaching, foundational gaps need going back a step before the current topic can stick.

### 7. Teaching Strategies
Differentiated strategies tied to the actual error/strength pattern and context, only where genuinely relevant.

### 8. Two-Week Plan
Concrete plan matching the learner's actual needs.

### 9. Message to the Learner
Genuine, specific, matching actual performance — not generic.

Be specific, evidence-based, and honest. Ground every claim in Step 1's marking.

Do not add a signature, author name, job title, or date at the end of the report."""
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=settings.GROQ_MAX_TOKENS,
            temperature=0.1,
            reasoning_effort=settings.GROQ_REASONING_EFFORT,
        )
    except APIError as e:
        # NFR28: never log the API key - the Groq SDK's error objects
        # carry the response status/body, not the Authorization header,
        # so this is safe to log as-is.
        logger.error("Groq script analysis call failed: %s", e)
        return Response(
            {
                "error": (
                    "The AI analysis service could not be reached or "
                    "rejected the request. Please try again or contact "
                    "the administrator."
                )
            },
            status=502,
        )

    finish_reason = response.choices[0].finish_reason
    if finish_reason == "length":
        # The model (and, for gpt-oss models, its hidden reasoning) used
        # up the max_tokens budget before finishing the report. Without
        # this check the half-written report would be returned as if it
        # were complete, cut off mid-sentence.
        logger.warning(
            "Groq script analysis call was truncated (finish_reason=length, "
            "model=%s, max_tokens=%s)",
            settings.GROQ_MODEL,
            settings.GROQ_MAX_TOKENS,
        )
        return Response(
            {
                "error": (
                    "The AI analysis service ran out of space before "
                    "finishing the report. Please try again."
                )
            },
            status=502,
        )

    analysis = response.choices[0].message.content

    if not analysis:
        logger.error(
            "Groq script analysis call returned an empty response "
            "(model=%s)",
            settings.GROQ_MODEL,
        )
        return Response(
            {
                "error": (
                    "The AI analysis service returned an empty response. "
                    "Please try again."
                )
            },
            status=502,
        )

    AuditLog.objects.create(
        user=request.user,
        action="Script_Analysis",
        target_type="Learner",
        target_id=learner.id,
        ip_address=request.META.get("REMOTE_ADDR"),
    )

    return Response(
        {
            "learner": f"{learner.first_name} {learner.surname}",
            "subject": subject,
            "assessment": assessment,
            "analysis": analysis,
            'debug_transcript': script_text,  # TEMPORARY — remove once verified
        }
    )
    
def transcribe_handwritten_script(pdf_file):
    """
    Reads a scanned/photographed handwritten learner script by rendering
    every PDF page to an image and sending ALL pages in a SINGLE Gemini
    request, rather than one request per page. This matters for two
    reasons: it cuts free-tier quota usage roughly N-fold for an N-page
    script, and it lets Gemini see the whole script at once rather than
    marking each page in isolation.
    """
    import fitz  # PyMuPDF
    from google import genai
    from google.genai import types

    pdf_file.seek(0)
    pdf_bytes = pdf_file.read()
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')

    client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

    # 200 dpi balances legibility of handwriting against payload size —
    # push higher only if testing shows misreads on real scripts.
    parts = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        parts.append(types.Part.from_bytes(data=pix.tobytes('png'), mime_type='image/png'))
    page_count = len(parts)
    doc.close()

    parts.append(
        f'This document has {page_count} pages, in order. Transcribe each '
        'handwritten exam answer script page exactly as written, including '
        'question numbers, all working shown, and the final answer for '
        'each question. Preserve mathematical notation as plain text (e.g. '
        'write x^2 for x squared, sqrt(x) for square roots, 3/8 for '
        'fractions). If a word or digit is illegible, write [illegible] '
        'rather than guessing. If any working is crossed out, wrap it as '
        '[crossed out: ...] rather than omitting it, so it stays clear '
        'that value was abandoned by the learner rather than their final '
        'answer. Do not solve, correct, mark, or comment on the answers — '
        'transcribe only what the learner wrote. Separate each page with '
        'a line reading "--- Page N ---".'
    )
    
    print(f'[Gemini] Sending {page_count} page image(s) in ONE request...')

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=parts,
    )

    print(f'[Gemini] Response received \u2014 exactly 1 API call used for this {page_count}-page script.')


    return _sanitize_extracted_text(response.text.strip())

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_script_analysis_pdf(request):
    """
    Renders an already-generated AI Script Analysis report as a
    downloadable PDF. Takes the report text plus learner/subject/
    assessment metadata that the frontend already holds in state after
    analysis — this does not re-run the analysis, just formats it.
    """
    learner    = request.data.get('learner', 'Learner')
    subject    = request.data.get('subject', '')
    assessment = request.data.get('assessment', '')
    analysis   = request.data.get('analysis', '')

    if not analysis:
        return Response({'error': 'No analysis content provided'}, status=400)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50,
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        'T', parent=styles['Title'], fontSize=18,
        textColor=colors.HexColor('#0F6B5C'), spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        'M', parent=styles['Normal'], fontSize=10,
        textColor=colors.HexColor('#6b7280'), spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        'H', parent=styles['Heading2'], fontSize=13,
        textColor=colors.HexColor('#0F6B5C'), spaceBefore=16, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'B', parent=styles['Normal'], fontSize=10.5,
        textColor=colors.HexColor('#1C2321'), leading=15, spaceAfter=6,
    )
    bullet_style = ParagraphStyle(
        'BL', parent=body_style, leftIndent=16,
    )

    story.append(Paragraph('AI Script Analysis Report', title_style))
    story.append(Paragraph(
        f'{learner} &middot; {subject} &middot; {assessment} '
        f'&middot; Generated {timezone.now().strftime("%d %B %Y")}',
        meta_style,
    ))

    # Split on the same "## " section convention the frontend parser uses,
    # so the PDF mirrors exactly what's shown on screen.
    sections = re.split(r'^## ', analysis, flags=re.MULTILINE)
    for section in sections:
        if not section.strip():
            continue
        lines = section.strip().split('\n')
        heading_line = re.sub(r'^\d+\.\s*', '', lines[0].strip())
        story.append(Paragraph(heading_line, heading_style))

        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            line_html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', line)
            if line.startswith(('- ', '* ', '\u2022 ')):
                text = re.sub(r'^[-*\u2022]\s*', '', line_html)
                story.append(Paragraph(f'\u2022 {text}', bullet_style))
            else:
                story.append(Paragraph(line_html, body_style))

    doc.build(story)
    buffer.seek(0)

    safe_name = f"{learner}_{subject}_analysis".replace(' ', '_')
    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{safe_name}.pdf"'
    return response