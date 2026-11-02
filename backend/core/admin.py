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
class AuditLogAdmin(admin.ModelAdmin):
    # NFR21: the audit log is read only for everyone, superusers included.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(AuditLog, AuditLogAdmin)
admin.site.register(Report)

admin.site.site_header = 'EarlySense Administration'
admin.site.site_title = 'EarlySense'
admin.site.index_title = 'Welcome to EarlySense Admin'