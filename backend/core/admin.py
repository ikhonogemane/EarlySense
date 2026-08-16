from django.contrib import admin
from .models import (
    User, Learner, AttendanceRecord, MarkRecord,
    Incident, RiskScore, Alert, Referral, AuditLog, Report
)

admin.site.register(User)
admin.site.register(Learner)
admin.site.register(AttendanceRecord)
admin.site.register(MarkRecord)
admin.site.register(Incident)
admin.site.register(RiskScore)
admin.site.register(Alert)
admin.site.register(Referral)
admin.site.register(AuditLog)
admin.site.register(Report)

admin.site.site_header = 'EarlySense Administration'
admin.site.site_title = 'EarlySense'
admin.site.index_title = 'Welcome to EarlySense Admin'