from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ─── AUTHENTICATION ──────────────────────────────────
    # Login → returns access token + refresh token
    path("auth/login/", views.CustomTokenObtainPairView.as_view(), name="login"),
    # Refresh → gives new access token when old one expires
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # ─── DASHBOARD ───────────────────────────────────────
    path("dashboard/", views.dashboard_stats, name="dashboard"),
    # ─── USERS ───────────────────────────────────────────
    path("users/", views.UserListCreateView.as_view(), name="user-list"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="user-detail"),
    path("auth/me/", views.current_user, name="current-user"),
    path("staff/", views.StaffListView.as_view(), name="staff-list"),
    # ─── LEARNERS ────────────────────────────────────────
    path("learners/", views.LearnerListCreateView.as_view(), name="learner-list"),
    path(
        "learners/<int:pk>/", views.LearnerDetailView.as_view(), name="learner-detail"
    ),
    # ─── ATTENDANCE ──────────────────────────────────────
    path(
        "attendance/", views.AttendanceListCreateView.as_view(), name="attendance-list"
    ),
    # ─── MARKS ───────────────────────────────────────────
    path("marks/", views.MarkListCreateView.as_view(), name="mark-list"),
    # ─── INCIDENTS ───────────────────────────────────────
    path("incidents/", views.IncidentListCreateView.as_view(), name="incident-list"),
    path(
        "incidents/<int:pk>/",
        views.IncidentDetailView.as_view(),
        name="incident-detail",
    ),
    # ─── RISK SCORES ─────────────────────────────────────
    path("risk-scores/", views.RiskScoreListView.as_view(), name="risk-score-list"),
    # ─── ALERTS ──────────────────────────────────────────
    path("alerts/", views.AlertListView.as_view(), name="alert-list"),
    path("alerts/<int:pk>/read/", views.mark_alert_read, name="alert-read"),
    path("alerts/read-all/", views.mark_all_alerts_read, name="alert-read-all"),
    # ─── REFERRALS ───────────────────────────────────────
    path("referrals/", views.ReferralListCreateView.as_view(), name="referral-list"),
    path(
        "referrals/<int:pk>/",
        views.ReferralDetailView.as_view(),
        name="referral-detail",
    ),
    # ─── AUDIT LOG ───────────────────────────────────────
    path("audit-log/", views.AuditLogListView.as_view(), name="audit-log"),
    # ─── REPORTS ─────────────────────────────────────────
    path("reports/generate/", views.run_generate_report, name="generate-report"),
    path("reports/", views.ReportListCreateView.as_view(), name="report-list"),
    # ─── CSV UPLOAD ──────────────────────────────────────
    path("upload-csv/", views.upload_csv, name="upload-csv"),
    
    path("attendance/mark/", views.mark_attendance, name="mark-attendance"),

    path('check-performance/', views.run_performance_check, name='check-performance'),

    path('analyse-script/', views.analyse_script, name='analyse-script'),
    
    path('educator/class-trends/', views.educator_class_trends, name='educator-class-trends'),
    
    path('generate-script-pdf/', views.generate_script_analysis_pdf, name='generate-script-pdf'),
]
