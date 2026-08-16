from rest_framework import serializers
from .models import (
    User, Learner, AttendanceRecord, MarkRecord,
    Incident, RiskScore, Alert, Referral, AuditLog, Report
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'is_active', 'created_at', 'assigned_grade', 'assigned_class_group']

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

class LearnerSerializer(serializers.ModelSerializer):
    risk_level = serializers.SerializerMethodField()

    class Meta:
        model = Learner
        fields = '__all__'

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