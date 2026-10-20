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
from django.db.models import Q
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


# ─── LEARNER DATA SCOPE (FR05-FR09, NFR16-NFR19) ─────────
# Which roles reach learner data, and for what. The System Administrator
# is in none of these sets, so it never sees learner data (NFR19).
PROFILE_ROLES = (
    Role.REGISTER_TEACHER,
    Role.GRADE_HEAD,
    Role.SCHOOL_CLERK,
    Role.WELLNESS_OFFICE,
)  # FR07: full learner profile data
CAPTURE_ROLES = (Role.REGISTER_TEACHER, Role.SUBJECT_TEACHER)  # FR05, FR06
ROSTER_ROLES = (Role.SUBJECT_TEACHER,)  # class roster only (id, name, grade, class)
WHOLE_SCHOOL_ROLES = (Role.SCHOOL_CLERK, Role.WELLNESS_OFFICE)  # NFR17


def learner_scope_q(user, roles, prefix=""):
    """
    NFR17, NFR18 - the learners `user` may reach through any of `roles`,
    as one Q over Learner fields (`prefix="learner__"` to filter
    attendance, marks, incidents or risk scores by their learner).

    School Clerk / Wellness Office: every learner. Grade Head: own
    grade_scope. Register / Subject Teacher: own grade_scope + class_scope.
    Rows are combined with OR, so a user with several roles gets the union.
    Returns None when nothing is reachable - deny by default, including a
    scoped role whose scope is missing.
    """
    if not (user and user.is_authenticated and user.is_active):
        return None
    combined = None
    for user_role in user.userrole_set.filter(role__name__in=roles).select_related("role"):
        name = user_role.role.name
        if name in WHOLE_SCHOOL_ROLES:
            return Q()
        if name == Role.GRADE_HEAD:
            if user_role.grade_scope is None:
                continue
            row_q = Q(**{f"{prefix}grade": user_role.grade_scope})
        else:
            if user_role.grade_scope is None or not user_role.class_scope:
                continue
            row_q = Q(**{
                f"{prefix}grade": user_role.grade_scope,
                f"{prefix}class_group": user_role.class_scope,
            })
        combined = row_q if combined is None else combined | row_q
    return combined


def scope_queryset(queryset, user, roles, prefix=""):
    """Filters `queryset` to the learners `user` may reach through `roles`."""
    q = learner_scope_q(user, roles, prefix)
    if q is None:
        return queryset.none()
    return queryset.filter(q)


class HasRoleForMethod(BasePermission):
    """
    NFR16 - for views where reading and writing belong to different roles.
    The view declares `method_roles = {"GET": (...), "POST": (...)}`; the
    user needs at least one of the roles listed for the request's method.
    A method that isn't listed is denied (deny by default). HEAD follows GET.
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        method = "GET" if request.method == "HEAD" else request.method
        roles = getattr(view, "method_roles", {}).get(method)
        if not roles:
            return False
        return user.userrole_set.filter(role__name__in=roles).exists()
