"""
Central permission layer (NFR16): one permission class per role, applied
to every endpoint. Deny by default - a view with no role class composed
in denies everyone except through whatever DRF default is set elsewhere.

Each class also denies an inactive user, even though SimpleJWT's
JWTAuthentication.get_user() already rejects an inactive user's token
during real authentication - that check doesn't run under
force_authenticate() in tests, so this is checked again here to make
"inactive users are denied" an actual property of the permission layer
itself, not just of the authentication backend.
"""
from rest_framework.permissions import BasePermission

from .models import Role


class _HasRole(BasePermission):
    role_name = None

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        return user.userrole_set.filter(role__name=self.role_name).exists()


class IsRegisterTeacher(_HasRole):
    role_name = Role.REGISTER_TEACHER


class IsSubjectTeacher(_HasRole):
    role_name = Role.SUBJECT_TEACHER


class IsGradeHead(_HasRole):
    role_name = Role.GRADE_HEAD


class IsSchoolClerk(_HasRole):
    role_name = Role.SCHOOL_CLERK


class IsWellnessOffice(_HasRole):
    role_name = Role.WELLNESS_OFFICE


class IsSystemAdministrator(_HasRole):
    role_name = Role.SYSTEM_ADMINISTRATOR
