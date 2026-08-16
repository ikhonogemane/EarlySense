from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)


# ─── USER ───────────────────────────────────────────────
class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("role", "System_Admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("System_Admin", "System Administrator"),
        ("School_Admin", "School Administrator"),
        ("Educator", "Educator"),
        ("LST_Member", "LST Member"),
    ]
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    failed_logins = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_grade = models.IntegerField(blank=True, null=True)
    assigned_class_group = models.CharField(max_length=10, blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "full_name", "role"]

    def __str__(self):
        return f"{self.full_name} ({self.role})"


# ─── LEARNER ─────────────────────────────────────────────
class Learner(models.Model):
    GENDER_CHOICES = [
        ("Male", "Male"),
        ("Female", "Female"),
        ("Other", "Other"),
    ]
    sasams_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=50)
    surname = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    grade = models.IntegerField()
    class_group = models.CharField(max_length=10)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    home_town = models.CharField(max_length=100)
    distance_km = models.DecimalField(max_digits=5, decimal_places=2)
    guardian_name = models.CharField(max_length=100)
    guardian_phone = models.CharField(max_length=20)
    income_index = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    enrolled_date = models.DateField()

    def __str__(self):
        return f"{self.first_name} {self.surname} - Grade {self.grade}"


# ─── ATTENDANCE RECORD ───────────────────────────────────
class AttendanceRecord(models.Model):
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="attendance"
    )
    date = models.DateField()
    is_present = models.BooleanField()
    period = models.CharField(max_length=10, null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = "Present" if self.is_present else "Absent"
        return f"{self.learner} - {self.date} - {status}"


# ─── MARK RECORD ─────────────────────────────────────────
class MarkRecord(models.Model):
    ASSESSMENT_CHOICES = [
        ("Test", "Test"),
        ("Exam", "Exam"),
        ("Assignment", "Assignment"),
        ("Project", "Project"),
    ]
    learner = models.ForeignKey(Learner, on_delete=models.CASCADE, related_name="marks")
    subject = models.CharField(max_length=50)
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_CHOICES)
    mark = models.DecimalField(max_digits=5, decimal_places=2)
    max_mark = models.DecimalField(max_digits=5, decimal_places=2)
    term = models.IntegerField()
    assessment_date = models.DateField()
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.learner} - {self.subject} - {self.mark}/{self.max_mark}"


# ─── INCIDENT ────────────────────────────────────────────
class Incident(models.Model):
    SEVERITY_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="incidents"
    )
    incident_date = models.DateField()
    incident_type = models.CharField(max_length=50)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    logged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.learner} - {self.incident_type} - {self.incident_date}"


# ─── RISK SCORE ──────────────────────────────────────────
class RiskScore(models.Model):
    RISK_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="risk_scores"
    )
    computed_date = models.DateTimeField(auto_now_add=True)
    attendance_rate = models.DecimalField(max_digits=5, decimal_places=2)
    avg_mark = models.DecimalField(max_digits=5, decimal_places=2)
    mark_trend = models.DecimalField(max_digits=5, decimal_places=2)
    incident_count = models.IntegerField()
    risk_score = models.DecimalField(max_digits=5, decimal_places=4)
    risk_level = models.CharField(max_length=10, choices=RISK_CHOICES)
    top_factor = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.learner} - {self.risk_level} - {self.risk_score}"


# ─── ALERT ───────────────────────────────────────────────
class Alert(models.Model):
    TYPE_CHOICES = [
        ("Attendance", "Attendance"),
        ("Performance", "Performance"),
        ("Behavioural", "Behavioural"),
        ("Risk_Level_Change", "Risk Level Change"),
    ]
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="alerts"
    )
    alert_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_email = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.learner} - {self.alert_type} - {self.created_at.date()}"


# ─── REFERRAL ────────────────────────────────────────────
class Referral(models.Model):
    URGENCY_CHOICES = [
        ("High", "High"),
        ("Medium", "Medium"),
        ("Low", "Low"),
    ]
    STATUS_CHOICES = [
        ("Open", "Open"),
        ("In_Progress", "In Progress"),
        ("Resolved", "Resolved"),
    ]
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="referrals"
    )
    referred_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="referrals_made"
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="referrals_assigned"
    )
    reason = models.CharField(max_length=100)
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES)
    notes = models.TextField(null=True, blank=True)
    follow_up_date = models.DateField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Open")
    resolution_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.learner} - {self.reason} - {self.status}"


# ─── AUDIT LOG ───────────────────────────────────────────
class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50, null=True, blank=True)
    target_id = models.IntegerField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.action} - {self.timestamp}"


# ─── REPORT ──────────────────────────────────────────────
class Report(models.Model):
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    report_type = models.CharField(max_length=100)
    parameters = models.JSONField()
    generated_at = models.DateTimeField(auto_now_add=True)
    file_path = models.CharField(max_length=255)
    file_size_kb = models.IntegerField()

    def __str__(self):
        return f"{self.report_type} - {self.generated_at.date()}"
