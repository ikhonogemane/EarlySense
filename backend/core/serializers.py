from rest_framework import serializers
from .models import (
    User, Role, Learner, AttendanceRecord, MarkRecord,
    Incident, RiskScore, Alert, Referral, AuditLog, Report
)

class UserSerializer(serializers.ModelSerializer):
    # FR02, NFR17, NFR18: every role this user holds via UserRole,
    # alongside the old single `role` field - kept side by side until the
    # frontend switches over to `roles` in phase (d).
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'roles', 'is_active', 'created_at', 'assigned_grade', 'assigned_class_group']

    def get_roles(self, obj):
        return list(obj.userrole_set.values_list('role__name', flat=True).distinct())

    def get_fields(self):
        # FR02, NFR16: only a System Administrator may change another
        # user's role or active status. A non-admin's PATCH/PUT still
        # goes through for every other field; role/is_active are just
        # dropped from validated_data, so they silently keep their old
        # value instead of letting a user self-promote. GET responses
        # and System_Admin writes are unaffected.
        fields = super().get_fields()
        request = self.context.get('request')
        is_system_admin = bool(
            request and request.user and request.user.is_authenticated
            and request.user.role == 'System_Admin'
        )
        if not is_system_admin:
            fields['role'].read_only = True
            fields['is_active'].read_only = True
        return fields

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['username', 'email', 'full_name', 'role', 'password', 'assigned_grade', 'assigned_class_group' ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class LearnerRosterSerializer(serializers.ModelSerializer):
    # NFR17: a Subject Teacher sees a class roster only - enough to take a
    # register or log an incident, none of the learner's profile data.
    class Meta:
        model = Learner
        fields = ['id', 'first_name', 'surname', 'grade', 'class_group']


class LearnerSerializer(serializers.ModelSerializer):
    risk_level = serializers.SerializerMethodField()

    class Meta:
        model = Learner
        fields = '__all__'

    def to_representation(self, instance):
        # NFR17, NFR18: when the view passes `full_learner_ids`, a learner
        # outside that set is one the user reaches only through a roster
        # role, so they get roster fields only - never more than a role
        # allows.
        full_ids = self.context.get('full_learner_ids')
        if full_ids is not None and instance.id not in full_ids:
            return LearnerRosterSerializer(instance, context=self.context).data
        return super().to_representation(instance)

    def get_risk_level(self, obj):
        latest = obj.risk_scores.order_by('-computed_date').first()
        if latest:
            return latest.risk_level
        return 'Unassessed'

class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = '__all__'

class MarkRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarkRecord
        fields = '__all__'

class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = '__all__'
        # FR06: the server records who logged the incident, never the client.
        read_only_fields = ['logged_by']

class RiskScoreSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()

    class Meta:
        model = RiskScore
        fields = '__all__'

    def get_learner_name(self, obj):
        return f'{obj.learner.first_name} {obj.learner.surname}'

class AlertSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = '__all__'

    def get_learner_name(self, obj):
        return f'{obj.learner.first_name} {obj.learner.surname}'

class ReferralSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()
    referred_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = '__all__'

    def get_learner_name(self, obj):
        return f'{obj.learner.first_name} {obj.learner.surname}'

    def get_referred_by_name(self, obj):
        return obj.referred_by.full_name if obj.referred_by else None

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else None

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else 'System'

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'

class StaffSerializer(serializers.ModelSerializer):
    # Narrow, PII-free shape for populating an "Assign To" dropdown (FR13):
    # id, name and role only - no email or anything else.
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'role']

    def get_role(self, obj):
        # Reads the view's prefetched assignable_user_roles (to_attr) -
        # never queries per user. Falls back to a live filter only if a
        # caller builds this serializer without that prefetch.
        user_roles = getattr(obj, 'assignable_user_roles', None)
        if user_roles is None:
            user_roles = obj.userrole_set.filter(
                role__name__in=[Role.GRADE_HEAD, Role.WELLNESS_OFFICE]
            ).select_related('role')
        names = {ur.role.name for ur in user_roles}
        return ', '.join(sorted(names))