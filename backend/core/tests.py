import importlib
import io
from contextlib import redirect_stdout
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.apps import apps
from django.contrib import admin
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.test import APITestCase

from . import urls as core_urls
from .admin import AuditLogAdmin
from .models import (
    AuditLog,
    Role,
    User,
    UserRole,
    Learner,
    AttendanceRecord,
    MarkRecord,
    Incident,
    RiskScore,
    Alert,
    Referral,
    Report,
    sync_user_roles_from_legacy,
    replace_user_roles_from_legacy,
)
from .permissions import (
    IsRegisterTeacher,
    IsSubjectTeacher,
    IsGradeHead,
    IsSchoolClerk,
    IsWellnessOffice,
    IsSystemAdministrator,
)

_map_migration = importlib.import_module(
    'core.migrations.0007_map_existing_users_to_roles'
)


class UserRoleEscalationTests(APITestCase):
    """
    FR02, NFR16 - only a System Administrator may change a user's role
    or active status. See docs/gap-analysis.md, section 6, item 3.
    """

    def setUp(self):
        self.educator = User.objects.create_user(
            username='educator1',
            email='educator1@example.com',
            password='testpass123',
            full_name='Test Educator',
            role='Educator',
        )
        sync_user_roles_from_legacy(self.educator)
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@example.com',
            password='testpass123',
            full_name='Test Admin',
            role='System_Admin',
        )
        sync_user_roles_from_legacy(self.admin)

    def test_educator_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'role': 'System_Admin'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.educator.refresh_from_db()
        self.assertEqual(self.educator.role, 'Educator')

    def test_educator_cannot_deactivate_self(self):
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.educator.refresh_from_db()
        self.assertTrue(self.educator.is_active)

    def test_system_admin_can_change_another_users_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'role': 'LST_Member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.educator.refresh_from_db()
        self.assertEqual(self.educator.role, 'LST_Member')


class UserCreationPermissionTests(APITestCase):
    """
    FR02, NFR16 - only a System Administrator may create a user account
    via POST /api/users/. See docs/gap-analysis.md, section 6, item 3.
    """

    def setUp(self):
        self.educator = User.objects.create_user(
            username='educator2',
            email='educator2@example.com',
            password='testpass123',
            full_name='Another Educator',
            role='Educator',
        )
        sync_user_roles_from_legacy(self.educator)
        self.admin = User.objects.create_user(
            username='admin2',
            email='admin2@example.com',
            password='testpass123',
            full_name='Another Admin',
            role='System_Admin',
        )
        sync_user_roles_from_legacy(self.admin)

    def test_educator_cannot_create_system_admin_user(self):
        self.client.force_authenticate(user=self.educator)
        count_before = User.objects.count()
        response = self.client.post(
            '/api/users/',
            {
                'username': 'newadmin',
                'email': 'newadmin@example.com',
                'full_name': 'New Admin',
                'role': 'System_Admin',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(User.objects.count(), count_before)
        self.assertFalse(User.objects.filter(username='newadmin').exists())

    def test_system_admin_can_create_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/users/',
            {
                'username': 'newteacher',
                'email': 'newteacher@example.com',
                'full_name': 'New Teacher',
                'role': 'Educator',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newteacher').exists())
        new_user = User.objects.get(username='newteacher')
        roles = set(
            UserRole.objects.filter(user=new_user).values_list('role__name', flat=True)
        )
        self.assertEqual(roles, {Role.REGISTER_TEACHER, Role.SUBJECT_TEACHER})


class RoleAndUserRoleModelTests(TestCase):
    """
    FR02, NFR17, NFR18 - the six-role, many-to-many model. See
    docs/data-model.md and docs/gap-analysis.md section 6, item 1.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='teacher1',
            email='teacher1@example.com',
            password='testpass123',
            full_name='Test Teacher',
            role='Educator',
        )

    def test_seed_migration_created_all_six_roles(self):
        self.assertEqual(Role.objects.count(), 6)
        for name in [
            Role.REGISTER_TEACHER,
            Role.SUBJECT_TEACHER,
            Role.GRADE_HEAD,
            Role.SCHOOL_CLERK,
            Role.WELLNESS_OFFICE,
            Role.SYSTEM_ADMINISTRATOR,
        ]:
            self.assertTrue(Role.objects.filter(name=name).exists())

    def test_role_str_is_its_name(self):
        role = Role.objects.get(name=Role.GRADE_HEAD)
        self.assertEqual(str(role), 'Grade Head')

    def test_user_can_hold_more_than_one_role(self):
        register_teacher = Role.objects.get(name=Role.REGISTER_TEACHER)
        subject_teacher = Role.objects.get(name=Role.SUBJECT_TEACHER)
        UserRole.objects.create(user=self.user, role=register_teacher, grade_scope=8, class_scope='8A')
        UserRole.objects.create(user=self.user, role=subject_teacher, grade_scope=8, class_scope='8A')
        self.assertEqual(self.user.userrole_set.count(), 2)

    def test_duplicate_user_role_scope_is_rejected(self):
        register_teacher = Role.objects.get(name=Role.REGISTER_TEACHER)
        UserRole.objects.create(user=self.user, role=register_teacher, grade_scope=8, class_scope='8A')
        with self.assertRaises(IntegrityError):
            UserRole.objects.create(user=self.user, role=register_teacher, grade_scope=8, class_scope='8A')

    def test_same_role_different_scope_is_allowed(self):
        register_teacher = Role.objects.get(name=Role.REGISTER_TEACHER)
        UserRole.objects.create(user=self.user, role=register_teacher, grade_scope=8, class_scope='8A')
        UserRole.objects.create(user=self.user, role=register_teacher, grade_scope=9, class_scope='9B')
        self.assertEqual(self.user.userrole_set.count(), 2)

    def test_user_role_str_includes_scope(self):
        grade_head = Role.objects.get(name=Role.GRADE_HEAD)
        user_role = UserRole.objects.create(user=self.user, role=grade_head, grade_scope=8)
        self.assertEqual(str(user_role), 'teacher1 - Grade Head (8)')


class ExistingUserRoleMigrationTests(TestCase):
    """
    FR02, NFR17, NFR18 - phase (b): exercises the actual
    0007_map_existing_users_to_roles migration functions (imported
    directly, not reimplemented) against a fixture mirroring today's 4
    real users (see docs/gap-analysis.md phase (b) mapping table).
    """

    def setUp(self):
        self.school_clerk_to_be = User.objects.create_user(
            username='d.mokoena', email='d.mokoena@example.com',
            password='testpass123', full_name='D Mokoena',
            role='School_Admin',
        )
        self.system_admin_to_be = User.objects.create_user(
            username='ikho', email='ikho@example.com',
            password='testpass123', full_name='Ikho',
            role='System_Admin',
        )
        self.wellness_office_to_be = User.objects.create_user(
            username='n.ndlovu', email='n.ndlovu@example.com',
            password='testpass123', full_name='N Ndlovu',
            role='LST_Member',
        )
        self.educator_to_be = User.objects.create_user(
            username='t.sithole', email='t.sithole@example.com',
            password='testpass123', full_name='T Sithole',
            role='Educator', assigned_grade=8, assigned_class_group='8A',
        )

    def _user_roles(self, user):
        return set(
            UserRole.objects.filter(user=user).values_list(
                'role__name', 'grade_scope', 'class_scope'
            )
        )

    def test_migration_maps_all_four_existing_users(self):
        _map_migration.map_existing_users(apps, schema_editor=None)

        self.assertEqual(
            self._user_roles(self.school_clerk_to_be),
            {('School Clerk', None, None)},
        )
        self.assertEqual(
            self._user_roles(self.system_admin_to_be),
            {('System Administrator', None, None)},
        )
        self.assertEqual(
            self._user_roles(self.wellness_office_to_be),
            {('Wellness Office', None, None)},
        )
        self.assertEqual(
            self._user_roles(self.educator_to_be),
            {
                ('Register Teacher', 8, '8A'),
                ('Subject Teacher', 8, '8A'),
            },
        )

    def test_migration_is_idempotent(self):
        _map_migration.map_existing_users(apps, schema_editor=None)
        _map_migration.map_existing_users(apps, schema_editor=None)
        self.assertEqual(UserRole.objects.filter(user=self.educator_to_be).count(), 2)

    def test_migration_is_reversible(self):
        _map_migration.map_existing_users(apps, schema_editor=None)
        self.assertTrue(UserRole.objects.filter(user=self.educator_to_be).exists())
        _map_migration.unmap_existing_users(apps, schema_editor=None)
        self.assertEqual(UserRole.objects.count(), 0)

    def test_no_user_becomes_grade_head(self):
        _map_migration.map_existing_users(apps, schema_editor=None)
        self.assertFalse(
            UserRole.objects.filter(role__name=Role.GRADE_HEAD).exists()
        )


class CreateSuperuserRoleSyncTests(TestCase):
    """FR02, NFR17, NFR18 - a newly created superuser also gets the
    matching UserRole row from now on, not just the legacy role field."""

    def test_create_superuser_creates_matching_user_role(self):
        admin = User.objects.create_superuser(
            username='newadmin', email='newadmin@example.com',
            password='testpass123', full_name='New Admin',
        )
        self.assertEqual(admin.role, 'System_Admin')
        self.assertTrue(
            UserRole.objects.filter(
                user=admin, role__name=Role.SYSTEM_ADMINISTRATOR
            ).exists()
        )


ALL_PERMISSION_CLASSES = {
    Role.REGISTER_TEACHER: IsRegisterTeacher,
    Role.SUBJECT_TEACHER: IsSubjectTeacher,
    Role.GRADE_HEAD: IsGradeHead,
    Role.SCHOOL_CLERK: IsSchoolClerk,
    Role.WELLNESS_OFFICE: IsWellnessOffice,
    Role.SYSTEM_ADMINISTRATOR: IsSystemAdministrator,
}


def _req(user):
    return SimpleNamespace(user=user)


def _slug(role_name):
    return role_name.replace(' ', '_').lower()


class RolePermissionClassTests(TestCase):
    """
    NFR16, NFR17, NFR18 - the six permission classes in permissions.py,
    tested directly against has_permission() rather than through an
    endpoint, so these are pinned to the permission layer itself.
    """

    def setUp(self):
        self.users = {}
        for role_name in ALL_PERMISSION_CLASSES:
            u = User.objects.create_user(
                username=f'perm_{_slug(role_name)}',
                email=f'perm_{_slug(role_name)}@example.com',
                password='testpass123',
                full_name=role_name,
                role='Educator',
            )
            UserRole.objects.create(user=u, role=Role.objects.get(name=role_name))
            self.users[role_name] = u

        self.no_role_user = User.objects.create_user(
            username='perm_norole', email='perm_norole@example.com',
            password='testpass123', full_name='No Role', role='Educator',
        )

        self.inactive_user = User.objects.create_user(
            username='perm_inactive', email='perm_inactive@example.com',
            password='testpass123', full_name='Inactive', role='Educator',
            is_active=False,
        )
        UserRole.objects.create(
            user=self.inactive_user,
            role=Role.objects.get(name=Role.SYSTEM_ADMINISTRATOR),
        )

        self.two_role_user = User.objects.create_user(
            username='perm_tworoles', email='perm_tworoles@example.com',
            password='testpass123', full_name='Two Roles', role='Educator',
        )
        UserRole.objects.create(
            user=self.two_role_user, role=Role.objects.get(name=Role.REGISTER_TEACHER)
        )
        UserRole.objects.create(
            user=self.two_role_user, role=Role.objects.get(name=Role.GRADE_HEAD)
        )

    def test_a_user_passes_only_the_class_for_the_role_they_hold(self):
        for held_role, user in self.users.items():
            for other_role, permission_cls in ALL_PERMISSION_CLASSES.items():
                result = permission_cls().has_permission(_req(user), None)
                if other_role == held_role:
                    self.assertTrue(
                        result,
                        f'{held_role} should pass {permission_cls.__name__}',
                    )
                else:
                    self.assertFalse(
                        result,
                        f'{held_role} should NOT pass {permission_cls.__name__} '
                        f'(only holds {held_role})',
                    )

    def test_user_with_no_roles_is_denied_every_class(self):
        for permission_cls in ALL_PERMISSION_CLASSES.values():
            self.assertFalse(
                permission_cls().has_permission(_req(self.no_role_user), None)
            )

    def test_anonymous_user_is_denied_every_class(self):
        anon = AnonymousUser()
        for permission_cls in ALL_PERMISSION_CLASSES.values():
            self.assertFalse(permission_cls().has_permission(_req(anon), None))

    def test_inactive_user_is_denied_even_with_a_matching_role(self):
        # inactive_user holds System Administrator but is deactivated.
        self.assertFalse(
            IsSystemAdministrator().has_permission(_req(self.inactive_user), None)
        )

    def test_user_with_two_roles_passes_both_classes(self):
        self.assertTrue(
            IsRegisterTeacher().has_permission(_req(self.two_role_user), None)
        )
        self.assertTrue(
            IsGradeHead().has_permission(_req(self.two_role_user), None)
        )
        self.assertFalse(
            IsSchoolClerk().has_permission(_req(self.two_role_user), None)
        )


class RoleGatedEndpointTests(APITestCase):
    """
    FR02, FR03, FR04, NFR16, NFR19 - /users/, /users/<pk>/ and
    /audit-log/ are System Administrator only; /upload-csv/ is School
    Clerk only.
    """

    def setUp(self):
        self.users = {}
        for role_name in ALL_PERMISSION_CLASSES:
            u = User.objects.create_user(
                username=f'ep_{_slug(role_name)}',
                email=f'ep_{_slug(role_name)}@example.com',
                password='testpass123',
                full_name=role_name,
                role='Educator',
            )
            UserRole.objects.create(user=u, role=Role.objects.get(name=role_name))
            self.users[role_name] = u

    def test_users_list_get_is_system_administrator_only(self):
        for role_name, user in self.users.items():
            self.client.force_authenticate(user=user)
            response = self.client.get('/api/users/')
            expected = (
                status.HTTP_200_OK
                if role_name == Role.SYSTEM_ADMINISTRATOR
                else status.HTTP_403_FORBIDDEN
            )
            self.assertEqual(response.status_code, expected, role_name)

        self.client.force_authenticate(user=None)
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_detail_get_and_patch_is_system_administrator_only(self):
        target = self.users[Role.REGISTER_TEACHER]
        for role_name, user in self.users.items():
            self.client.force_authenticate(user=user)
            get_response = self.client.get(f'/api/users/{target.id}/')
            patch_response = self.client.patch(
                f'/api/users/{target.id}/', {'full_name': 'Renamed'}, format='json'
            )
            if role_name == Role.SYSTEM_ADMINISTRATOR:
                self.assertEqual(get_response.status_code, status.HTTP_200_OK)
                self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
            else:
                self.assertEqual(
                    get_response.status_code, status.HTTP_403_FORBIDDEN, role_name
                )
                self.assertEqual(
                    patch_response.status_code, status.HTTP_403_FORBIDDEN, role_name
                )

        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/users/{target.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_audit_log_get_is_system_administrator_only(self):
        for role_name, user in self.users.items():
            self.client.force_authenticate(user=user)
            response = self.client.get('/api/audit-log/')
            expected = (
                status.HTTP_200_OK
                if role_name == Role.SYSTEM_ADMINISTRATOR
                else status.HTTP_403_FORBIDDEN
            )
            self.assertEqual(response.status_code, expected, role_name)

        self.client.force_authenticate(user=None)
        response = self.client.get('/api/audit-log/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_upload_csv_is_school_clerk_only(self):
        for role_name, user in self.users.items():
            self.client.force_authenticate(user=user)
            response = self.client.post('/api/upload-csv/', {}, format='multipart')
            if role_name == Role.SCHOOL_CLERK:
                # No file was posted, so a School Clerk gets past the
                # permission check and hits the view's own 400 - which is
                # exactly what proves permission was granted.
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            else:
                self.assertEqual(
                    response.status_code, status.HTTP_403_FORBIDDEN, role_name
                )


class StaffListEndpointTests(APITestCase):
    """
    FR13 - the narrow /staff/ endpoint for the referral "Assign To"
    dropdown: Grade Head/Wellness Office callers only, active
    Grade-Head-or-Wellness-Office staff only, id/full_name/role only.
    """

    def setUp(self):
        self.grade_head_role = Role.objects.get(name=Role.GRADE_HEAD)
        self.wellness_role = Role.objects.get(name=Role.WELLNESS_OFFICE)

        self.caller_grade_head = User.objects.create_user(
            username='staff_caller_gh', email='staff_caller_gh@example.com',
            password='testpass123', full_name='Caller GH', role='Educator',
        )
        UserRole.objects.create(user=self.caller_grade_head, role=self.grade_head_role)

        self.caller_wellness = User.objects.create_user(
            username='staff_caller_wo', email='staff_caller_wo@example.com',
            password='testpass123', full_name='Caller WO', role='Educator',
        )
        UserRole.objects.create(user=self.caller_wellness, role=self.wellness_role)

        self.staff_grade_head_only = User.objects.create_user(
            username='staff_gh_only', email='staff_gh_only@example.com',
            password='testpass123', full_name='Staff GH', role='Educator',
        )
        UserRole.objects.create(
            user=self.staff_grade_head_only, role=self.grade_head_role
        )

        self.staff_both = User.objects.create_user(
            username='staff_both', email='staff_both@example.com',
            password='testpass123', full_name='Staff Both', role='Educator',
        )
        UserRole.objects.create(user=self.staff_both, role=self.grade_head_role)
        UserRole.objects.create(user=self.staff_both, role=self.wellness_role)

        self.staff_inactive = User.objects.create_user(
            username='staff_inactive', email='staff_inactive@example.com',
            password='testpass123', full_name='Staff Inactive', role='Educator',
            is_active=False,
        )
        UserRole.objects.create(user=self.staff_inactive, role=self.wellness_role)

        self.not_staff = User.objects.create_user(
            username='staff_not_staff', email='staff_not_staff@example.com',
            password='testpass123', full_name='Not Staff', role='Educator',
        )
        UserRole.objects.create(
            user=self.not_staff, role=Role.objects.get(name=Role.REGISTER_TEACHER)
        )

        self.other_four = []
        for role_name in [
            Role.REGISTER_TEACHER,
            Role.SUBJECT_TEACHER,
            Role.SCHOOL_CLERK,
            Role.SYSTEM_ADMINISTRATOR,
        ]:
            u = User.objects.create_user(
                username=f'staff_denied_{_slug(role_name)}',
                email=f'staff_denied_{_slug(role_name)}@example.com',
                password='testpass123', full_name=role_name, role='Educator',
            )
            UserRole.objects.create(user=u, role=Role.objects.get(name=role_name))
            self.other_four.append(u)

    def test_grade_head_and_wellness_office_get_200(self):
        for caller in [self.caller_grade_head, self.caller_wellness]:
            self.client.force_authenticate(user=caller)
            response = self.client.get('/api/staff/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_other_four_roles_get_403(self):
        for user in self.other_four:
            self.client.force_authenticate(user=user)
            response = self.client.get('/api/staff/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_response_keys_are_exactly_id_full_name_role(self):
        self.client.force_authenticate(user=self.caller_grade_head)
        response = self.client.get('/api/staff/')
        self.assertGreater(len(response.data), 0)
        for row in response.data:
            self.assertEqual(set(row.keys()), {'id', 'full_name', 'role'})

    def test_only_active_grade_head_or_wellness_users_are_listed(self):
        self.client.force_authenticate(user=self.caller_grade_head)
        response = self.client.get('/api/staff/')
        ids = {row['id'] for row in response.data}
        self.assertIn(self.staff_grade_head_only.id, ids)
        self.assertIn(self.staff_both.id, ids)
        self.assertIn(self.caller_grade_head.id, ids)
        self.assertIn(self.caller_wellness.id, ids)
        self.assertNotIn(self.staff_inactive.id, ids)
        self.assertNotIn(self.not_staff.id, ids)
        for u in self.other_four:
            self.assertNotIn(u.id, ids)

    def test_user_holding_both_roles_appears_once(self):
        self.client.force_authenticate(user=self.caller_grade_head)
        response = self.client.get('/api/staff/')
        ids = [row['id'] for row in response.data]
        self.assertEqual(ids.count(self.staff_both.id), 1)
        both_row = next(row for row in response.data if row['id'] == self.staff_both.id)
        self.assertEqual(both_row['role'], 'Grade Head, Wellness Office')


class UserRoleSyncOnWriteTests(APITestCase):
    """
    FR02, NFR17, NFR18 - until phase (d), POST/PATCH on /users/ keeps
    UserRole in sync with the still-primary legacy role field.
    """

    def setUp(self):
        self.admin = User.objects.create_user(
            username='sync_admin', email='sync_admin@example.com',
            password='testpass123', full_name='Sync Admin', role='System_Admin',
        )
        UserRole.objects.create(
            user=self.admin, role=Role.objects.get(name=Role.SYSTEM_ADMINISTRATOR)
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_educator_creates_register_and_subject_teacher_rows(self):
        response = self.client.post(
            '/api/users/',
            {
                'username': 'sync_new_educator',
                'email': 'sync_new_educator@example.com',
                'full_name': 'New Educator',
                'role': 'Educator',
                'password': 'testpass123',
                'assigned_grade': 9,
                'assigned_class_group': '9B',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_user = User.objects.get(username='sync_new_educator')
        roles = set(
            UserRole.objects.filter(user=new_user).values_list(
                'role__name', 'grade_scope', 'class_scope'
            )
        )
        self.assertEqual(
            roles,
            {('Register Teacher', 9, '9B'), ('Subject Teacher', 9, '9B')},
        )

    def test_patch_role_from_educator_to_school_admin_replaces_roles(self):
        target = User.objects.create_user(
            username='sync_changing_user', email='sync_changing_user@example.com',
            password='testpass123', full_name='Changing User',
            role='Educator', assigned_grade=8, assigned_class_group='8A',
        )
        sync_user_roles_from_legacy(target)
        self.assertEqual(UserRole.objects.filter(user=target).count(), 2)

        response = self.client.patch(
            f'/api/users/{target.id}/', {'role': 'School_Admin'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        roles = set(
            UserRole.objects.filter(user=target).values_list('role__name', flat=True)
        )
        self.assertEqual(roles, {'School Clerk'})

    def test_patch_unrelated_field_leaves_roles_unchanged(self):
        target = User.objects.create_user(
            username='sync_unrelated_patch', email='sync_unrelated_patch@example.com',
            password='testpass123', full_name='Unrelated',
            role='Educator', assigned_grade=8, assigned_class_group='8A',
        )
        sync_user_roles_from_legacy(target)
        before = set(
            UserRole.objects.filter(user=target).values_list('id', flat=True)
        )

        response = self.client.patch(
            f'/api/users/{target.id}/', {'full_name': 'Unrelated Renamed'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        after = set(
            UserRole.objects.filter(user=target).values_list('id', flat=True)
        )
        # Same row IDs, not just the same count - proves nothing was
        # deleted and recreated when role/scope didn't change.
        self.assertEqual(before, after)


class ReplaceUserRolesAtomicityTests(TestCase):
    """
    FR02, NFR17, NFR18 - replace_user_roles_from_legacy's delete-then-
    recreate must be atomic: if the recreate half fails, the delete half
    must roll back too, so a user is never left with zero roles.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='atomic_user', email='atomic_user@example.com',
            password='testpass123', full_name='Atomic User',
            role='Educator', assigned_grade=8, assigned_class_group='8A',
        )
        sync_user_roles_from_legacy(self.user)
        self.original_role_ids = set(
            UserRole.objects.filter(user=self.user).values_list('id', flat=True)
        )
        self.assertEqual(len(self.original_role_ids), 2)

    def test_atomic_wrapper_rolls_back_delete_if_sync_raises(self):
        with patch(
            'core.models.sync_user_roles_from_legacy',
            side_effect=Exception('boom'),
        ):
            with self.assertRaises(Exception):
                replace_user_roles_from_legacy(self.user)

        remaining_ids = set(
            UserRole.objects.filter(user=self.user).values_list('id', flat=True)
        )
        self.assertEqual(remaining_ids, self.original_role_ids)


class CurrentUserRolesTests(APITestCase):
    """
    FR02, NFR17, NFR18 - /api/auth/me/ returns every role the user holds
    via UserRole as `roles`, alongside the still-primary legacy `role`
    string, until the frontend switches over in phase (d).
    """

    def test_me_returns_roles_list_and_legacy_role(self):
        user = User.objects.create_user(
            username='me_two_roles', email='me_two_roles@example.com',
            password='testpass123', full_name='Two Roles', role='Educator',
        )
        UserRole.objects.create(
            user=user, role=Role.objects.get(name=Role.REGISTER_TEACHER),
            grade_scope=8, class_scope='8A',
        )
        UserRole.objects.create(
            user=user, role=Role.objects.get(name=Role.GRADE_HEAD),
            grade_scope=8,
        )
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertCountEqual(
            response.data['roles'], [Role.REGISTER_TEACHER, Role.GRADE_HEAD]
        )
        self.assertEqual(response.data['role'], 'Educator')


# ─── PHASE c2: learner data endpoints (FR05-FR09, NFR16-NFR19) ─────────

ROSTER_KEYS = {'id', 'first_name', 'surname', 'grade', 'class_group'}


def _make_learner(first_name, grade, class_group, is_active=True):
    return Learner.objects.create(
        first_name=first_name, surname='Test', date_of_birth=date(2010, 1, 1),
        grade=grade, class_group=class_group, gender='Male',
        home_town='Kimberley', distance_km=Decimal('2.50'),
        guardian_name='Guardian', guardian_phone='0820000000',
        enrolled_date=date(2024, 1, 15), is_active=is_active,
    )


def _make_scoped_user(username, scopes):
    # create_user does not sync UserRole, so the user holds exactly the
    # (role, grade_scope, class_scope) rows given here.
    user = User.objects.create_user(
        username=username, email=f'{username}@example.com',
        password='testpass123', full_name=username, role='Educator',
    )
    for role_name, grade_scope, class_scope in scopes:
        UserRole.objects.create(
            user=user, role=Role.objects.get(name=role_name),
            grade_scope=grade_scope, class_scope=class_scope,
        )
    return user


class C2Fixture:
    """
    Learners in 8A, 8B and 9A (plus an inactive 8A learner), each with one
    attendance record, mark, incident and risk score; and one user per
    role: Register and Subject Teacher for 8A, Grade Head for grade 8,
    School Clerk, Wellness Office, System Administrator, and no role.
    """

    def setUp(self):
        self.l8a = _make_learner('Eight-A', 8, '8A')
        self.l8b = _make_learner('Eight-B', 8, '8B')
        self.l9a = _make_learner('Nine-A', 9, '9A')
        self.l8a_inactive = _make_learner('Left', 8, '8A', is_active=False)

        self.incidents = {}
        for learner in (self.l8a, self.l8b, self.l9a):
            AttendanceRecord.objects.create(
                learner=learner, date=date(2026, 10, 1), is_present=True,
            )
            MarkRecord.objects.create(
                learner=learner, subject='Maths', assessment_type='Test',
                mark=Decimal('60'), max_mark=Decimal('100'), term=3,
                assessment_date=date(2026, 9, 1),
            )
            self.incidents[learner.class_group] = Incident.objects.create(
                learner=learner, incident_date=date(2026, 10, 1),
                incident_type=f'Type-{learner.class_group}',
                description='Test incident', severity='Low',
            )
            RiskScore.objects.create(
                learner=learner, attendance_rate=Decimal('90'),
                avg_mark=Decimal('60'), mark_trend=Decimal('0'),
                incident_count=1, risk_score=Decimal('0.2000'),
                risk_level='Low', top_factor='None',
            )

        self.users = {
            'rt': _make_scoped_user('c2_rt', [(Role.REGISTER_TEACHER, 8, '8A')]),
            'st': _make_scoped_user('c2_st', [(Role.SUBJECT_TEACHER, 8, '8A')]),
            'gh': _make_scoped_user('c2_gh', [(Role.GRADE_HEAD, 8, None)]),
            'sc': _make_scoped_user('c2_sc', [(Role.SCHOOL_CLERK, None, None)]),
            'wo': _make_scoped_user('c2_wo', [(Role.WELLNESS_OFFICE, None, None)]),
            'sa': _make_scoped_user('c2_sa', [(Role.SYSTEM_ADMINISTRATOR, None, None)]),
            'none': _make_scoped_user('c2_none', []),
        }

    def _get_ids(self, user, url, key='id'):
        self.client.force_authenticate(user=user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, url)
        return {row[key] for row in response.data}

    def _incident_payload(self, learner, **extra):
        payload = {
            'learner': learner.id, 'incident_date': '2026-10-02',
            'incident_type': 'Disruption', 'description': 'Test',
            'severity': 'Low',
        }
        payload.update(extra)
        return payload


class C2RoleMatrixTests(C2Fixture, APITestCase):
    """
    NFR16, NFR19 - every c2 endpoint and method against all six roles, a
    user with no role and an anonymous caller. Scope is tested separately.
    """

    def _requests(self):
        # (label, method, url, payload, roles allowed, success status)
        return [
            ('learner-list', 'get', '/api/learners/', None,
             {'rt', 'st', 'gh', 'sc', 'wo'}, 200),
            ('learner-detail', 'get', f'/api/learners/{self.l8a.id}/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('attendance-list', 'get', '/api/attendance/', None,
             {'rt', 'st', 'gh', 'sc', 'wo'}, 200),
            ('mark-list', 'get', '/api/marks/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('incident-list', 'get', '/api/incidents/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('incident-detail', 'get', f'/api/incidents/{self.incidents["8A"].id}/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('risk-score-list', 'get', '/api/risk-scores/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('educator-class-trends', 'get', '/api/educator/class-trends/', None,
             {'rt'}, 200),
            ('incident-list POST', 'post', '/api/incidents/',
             self._incident_payload(self.l8a), {'rt', 'st'}, 201),
            ('mark-attendance', 'post', '/api/attendance/mark/',
             {'date': '2026-10-02',
              'attendances': [{'learner_id': self.l8a.id, 'is_present': True}]},
             {'rt', 'st'}, 200),
            ('check-performance', 'post', '/api/check-performance/', {},
             {'sa'}, 200),
        ]

    def test_each_role_gets_exactly_the_endpoints_it_is_allowed(self):
        for label, method, url, payload, allowed, ok_status in self._requests():
            for key, user in self.users.items():
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, payload, format='json')
                expected = ok_status if key in allowed else status.HTTP_403_FORBIDDEN
                self.assertEqual(
                    response.status_code, expected, f'{label} as {key}'
                )

    def test_anonymous_caller_gets_401_everywhere(self):
        self.client.force_authenticate(user=None)
        for label, method, url, payload, _, _ in self._requests():
            response = getattr(self.client, method)(url, payload, format='json')
            self.assertEqual(
                response.status_code, status.HTTP_401_UNAUTHORIZED, label
            )

    def test_inactive_user_is_denied_even_with_a_matching_role(self):
        user = _make_scoped_user('c2_inactive', [(Role.SCHOOL_CLERK, None, None)])
        user.is_active = False
        user.save()
        self.client.force_authenticate(user=user)
        self.assertEqual(
            self.client.get('/api/learners/').status_code, status.HTTP_403_FORBIDDEN
        )


class C2WriteDeniedTests(C2Fixture, APITestCase):
    """Locked decision: direct writes to learner data are denied for every role."""

    def test_direct_writes_are_denied_for_every_role(self):
        learner_url = f'/api/learners/{self.l8a.id}/'
        incident_url = f'/api/incidents/{self.incidents["8A"].id}/'
        writes = [
            ('post', '/api/learners/', {'first_name': 'New'}),
            ('put', learner_url, {'first_name': 'Changed'}),
            ('patch', learner_url, {'first_name': 'Changed'}),
            ('delete', learner_url, None),
            ('post', '/api/attendance/',
             {'learner': self.l8a.id, 'date': '2026-10-03', 'is_present': False}),
            ('post', '/api/marks/', {'learner': self.l8a.id, 'mark': '10'}),
            ('put', incident_url, {'description': 'Changed'}),
            ('patch', incident_url, {'description': 'Changed'}),
            ('delete', incident_url, None),
        ]
        counts_before = (
            Learner.objects.count(), AttendanceRecord.objects.count(),
            MarkRecord.objects.count(), Incident.objects.count(),
        )
        for method, url, payload in writes:
            for key, user in self.users.items():
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, payload, format='json')
                self.assertIn(
                    response.status_code,
                    (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
                    f'{method.upper()} {url} as {key}',
                )
        counts_after = (
            Learner.objects.count(), AttendanceRecord.objects.count(),
            MarkRecord.objects.count(), Incident.objects.count(),
        )
        self.assertEqual(counts_before, counts_after)
        self.l8a.refresh_from_db()
        self.assertEqual(self.l8a.first_name, 'Eight-A')
        self.incidents['8A'].refresh_from_db()
        self.assertEqual(self.incidents['8A'].description, 'Test incident')


class C2ScopeTests(C2Fixture, APITestCase):
    """NFR17, NFR18 - each role sees only its own class, grade or school."""

    def test_register_teacher_sees_only_own_class(self):
        rt = self.users['rt']
        own = {self.l8a.id}
        self.assertEqual(self._get_ids(rt, '/api/learners/'), own)
        self.assertEqual(self._get_ids(rt, '/api/attendance/', 'learner'), own)
        self.assertEqual(self._get_ids(rt, '/api/marks/', 'learner'), own)
        self.assertEqual(self._get_ids(rt, '/api/incidents/', 'learner'), own)
        self.assertEqual(self._get_ids(rt, '/api/risk-scores/', 'learner'), own)

    def test_out_of_scope_detail_is_404(self):
        self.client.force_authenticate(user=self.users['rt'])
        self.assertEqual(
            self.client.get(f'/api/learners/{self.l8a.id}/').status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(f'/api/learners/{self.l8b.id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(f'/api/incidents/{self.incidents["8B"].id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_grade_head_sees_own_grade(self):
        gh = self.users['gh']
        self.assertEqual(self._get_ids(gh, '/api/learners/'), {self.l8a.id, self.l8b.id})
        self.assertEqual(
            self._get_ids(gh, '/api/risk-scores/', 'learner'), {self.l8a.id, self.l8b.id}
        )
        self.client.force_authenticate(user=gh)
        self.assertEqual(
            self.client.get(f'/api/learners/{self.l9a.id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_clerk_and_wellness_office_see_every_active_learner(self):
        everyone = {self.l8a.id, self.l8b.id, self.l9a.id}
        for key in ('sc', 'wo'):
            self.assertEqual(self._get_ids(self.users[key], '/api/learners/'), everyone, key)
            self.assertEqual(
                self._get_ids(self.users[key], '/api/risk-scores/', 'learner'),
                everyone, key,
            )

    def test_combined_roles_get_the_union_of_their_scopes(self):
        user = _make_scoped_user('c2_rt_gh', [
            (Role.REGISTER_TEACHER, 8, '8A'),
            (Role.GRADE_HEAD, 9, None),
        ])
        self.assertEqual(self._get_ids(user, '/api/learners/'), {self.l8a.id, self.l9a.id})

    def test_scoped_role_with_missing_scope_sees_nothing(self):
        user = _make_scoped_user('c2_rt_noscope', [(Role.REGISTER_TEACHER, None, None)])
        self.assertEqual(self._get_ids(user, '/api/learners/'), set())

    def test_subject_teacher_gets_roster_fields_only(self):
        st = self.users['st']
        self.client.force_authenticate(user=st)
        response = self.client.get('/api/learners/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({row['id'] for row in response.data}, {self.l8a.id})
        for row in response.data:
            self.assertEqual(set(row.keys()), ROSTER_KEYS)
        self.assertEqual(
            self._get_ids(st, '/api/attendance/', 'learner'), {self.l8a.id}
        )

    def test_full_record_wins_over_roster_for_the_same_user(self):
        user = _make_scoped_user('c2_rt_st', [
            (Role.REGISTER_TEACHER, 8, '8A'),
            (Role.SUBJECT_TEACHER, 8, '8B'),
        ])
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/learners/')
        rows = {row['id']: row for row in response.data}
        self.assertEqual(set(rows), {self.l8a.id, self.l8b.id})
        self.assertIn('guardian_phone', rows[self.l8a.id])
        self.assertEqual(set(rows[self.l8b.id].keys()), ROSTER_KEYS)


class C2CaptureTests(C2Fixture, APITestCase):
    """FR05, FR06 - capture only for own classes, all or nothing."""

    def test_mark_attendance_with_an_out_of_scope_learner_writes_nothing(self):
        self.client.force_authenticate(user=self.users['rt'])
        before = AttendanceRecord.objects.count()
        response = self.client.post('/api/attendance/mark/', {
            'date': '2026-10-05',
            'attendances': [
                {'learner_id': self.l8a.id, 'is_present': True},
                {'learner_id': self.l8b.id, 'is_present': False},
                {'learner_id': 999999, 'is_present': True},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['invalid_learner_ids'], [self.l8b.id, 999999])
        self.assertEqual(AttendanceRecord.objects.count(), before)

    def test_mark_attendance_rejects_an_inactive_learner(self):
        self.client.force_authenticate(user=self.users['rt'])
        response = self.client.post('/api/attendance/mark/', {
            'date': '2026-10-05',
            'attendances': [{'learner_id': self.l8a_inactive.id, 'is_present': True}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['invalid_learner_ids'], [self.l8a_inactive.id])

    def test_subject_teacher_marks_own_class(self):
        st = self.users['st']
        self.client.force_authenticate(user=st)
        response = self.client.post('/api/attendance/mark/', {
            'date': '2026-10-05',
            'attendances': [{'learner_id': self.l8a.id, 'is_present': False}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        record = AttendanceRecord.objects.get(learner=self.l8a, date=date(2026, 10, 5))
        self.assertFalse(record.is_present)
        self.assertEqual(record.recorded_by, st)

    def test_incident_for_an_out_of_scope_learner_is_rejected(self):
        self.client.force_authenticate(user=self.users['rt'])
        before = Incident.objects.count()
        response = self.client.post(
            '/api/incidents/', self._incident_payload(self.l8b), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['invalid_learner_ids'], [self.l8b.id])
        self.assertEqual(Incident.objects.count(), before)

    def test_incident_logged_by_is_always_the_caller(self):
        rt = self.users['rt']
        self.client.force_authenticate(user=rt)
        response = self.client.post(
            '/api/incidents/',
            self._incident_payload(self.l8a, logged_by=self.users['sc'].id),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Incident.objects.get(id=response.data['id']).logged_by, rt)

    def test_check_performance_returns_counts_only(self):
        self.client.force_authenticate(user=self.users['sa'])
        response = self.client.post('/api/check-performance/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data.keys()), {'learners_checked', 'alerts_created'})
        self.assertEqual(response.data['learners_checked'], 3)


class C2ClassTrendsTests(C2Fixture, APITestCase):
    """FR07, NFR17 - the Register Teacher's class trends come from UserRole."""

    def _incident_types(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/educator/class-trends/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row['type'] for row in response.data['incident_breakdown']}

    def test_multiple_register_teacher_classes_are_merged(self):
        user = _make_scoped_user('c2_rt_two', [
            (Role.REGISTER_TEACHER, 8, '8A'),
            (Role.REGISTER_TEACHER, 9, '9A'),
        ])
        self.assertEqual(self._incident_types(user), {'Type-8A', 'Type-9A'})

    def test_scope_comes_from_user_role_not_legacy_assignment(self):
        user = _make_scoped_user('c2_rt_legacy', [(Role.REGISTER_TEACHER, 8, '8A')])
        user.assigned_grade = 8
        user.assigned_class_group = '8B'
        user.save()
        self.assertEqual(self._incident_types(user), {'Type-8A'})


# ─── PHASE c3: alerts (FR10, NFR16, NFR17) ───────────────────────────
# Subject Teacher is an alert recipient by client decision, a deviation
# from FR10 and Table 7 (see ALERT_ROLES in permissions.py).

class C3AlertFixture(C2Fixture):
    def setUp(self):
        super().setUp()
        self.alerts = {
            learner.class_group: Alert.objects.create(
                learner=learner, alert_type='Performance',
                message=f'Alert for {learner.class_group}',
            )
            for learner in (self.l8a, self.l8b, self.l9a)
        }

    def _alert_ids(self, user):
        return self._get_ids(user, '/api/alerts/')

    def _unread(self, class_group):
        self.alerts[class_group].refresh_from_db()
        return not self.alerts[class_group].is_read


class C3AlertRoleMatrixTests(C3AlertFixture, APITestCase):
    def _requests(self):
        return [
            ('alert-list', 'get', '/api/alerts/'),
            ('alert-read', 'patch', f'/api/alerts/{self.alerts["8A"].id}/read/'),
            ('alert-read-all', 'post', '/api/alerts/read-all/'),
        ]

    def test_only_register_subject_teacher_and_grade_head_reach_alerts(self):
        allowed = {'rt', 'st', 'gh'}
        for label, method, url in self._requests():
            for key, user in self.users.items():
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, {}, format='json')
                expected = (
                    status.HTTP_200_OK if key in allowed else status.HTTP_403_FORBIDDEN
                )
                self.assertEqual(response.status_code, expected, f'{label} as {key}')

    def test_anonymous_caller_gets_401(self):
        self.client.force_authenticate(user=None)
        for label, method, url in self._requests():
            response = getattr(self.client, method)(url, {}, format='json')
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, label)


class C3AlertScopeTests(C3AlertFixture, APITestCase):
    def test_register_and_subject_teacher_see_only_own_class(self):
        own = {self.alerts['8A'].id}
        self.assertEqual(self._alert_ids(self.users['rt']), own)
        self.assertEqual(self._alert_ids(self.users['st']), own)

    def test_grade_head_sees_own_grade(self):
        self.assertEqual(
            self._alert_ids(self.users['gh']),
            {self.alerts['8A'].id, self.alerts['8B'].id},
        )

    def test_subject_teacher_with_no_scope_sees_none(self):
        user = _make_scoped_user('c3_st_noscope', [(Role.SUBJECT_TEACHER, None, None)])
        self.assertEqual(self._alert_ids(user), set())

    def test_subject_teacher_cannot_mark_an_out_of_scope_alert_read(self):
        self.client.force_authenticate(user=self.users['st'])
        response = self.client.patch(
            f'/api/alerts/{self.alerts["8B"].id}/read/', {}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(self._unread('8B'))

    def test_read_all_only_touches_alerts_in_scope(self):
        self.client.force_authenticate(user=self.users['st'])
        response = self.client.post('/api/alerts/read-all/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(self._unread('8A'))
        self.assertTrue(self._unread('8B'))
        self.assertTrue(self._unread('9A'))

    def test_grade_head_read_all_leaves_other_grades_unread(self):
        self.client.force_authenticate(user=self.users['gh'])
        self.client.post('/api/alerts/read-all/', {}, format='json')
        self.assertFalse(self._unread('8A'))
        self.assertFalse(self._unread('8B'))
        self.assertTrue(self._unread('9A'))


# ─── PHASE c3: dashboard, referrals, reports, script analysis ────────
# (FR09, FR12, FR13, FR15, FR17, NFR16-NFR19)

class C3Fixture(C3AlertFixture):
    """
    Adds referrals for 8A (one by the 8A Register Teacher, one by another
    8A Register Teacher), 8B and 9A, and one Report row each for the
    Register Teacher and the School Clerk.
    """

    def setUp(self):
        super().setUp()
        self.other_rt = _make_scoped_user('c3_rt_other', [(Role.REGISTER_TEACHER, 8, '8A')])
        self.referrals = {
            '8A-own': self._referral(self.l8a, self.users['rt']),
            '8A-other': self._referral(self.l8a, self.other_rt),
            '8B': self._referral(self.l8b, None),
            '9A': self._referral(self.l9a, None),
        }
        self.reports = {
            key: Report.objects.create(
                generated_by=self.users[key], report_type='at_risk',
                parameters={}, file_path='', file_size_kb=1,
            )
            for key in ('rt', 'sc')
        }

    def _referral(self, learner, referred_by):
        return Referral.objects.create(
            learner=learner, referred_by=referred_by, reason='Hunger',
            urgency='High', follow_up_date=date(2026, 11, 1),
        )

    def _referral_payload(self, learner, **extra):
        payload = {
            'learner': learner.id, 'reason': 'Hunger', 'urgency': 'High',
            'follow_up_date': '2026-11-01', 'notes': 'Test',
        }
        payload.update(extra)
        return payload

    def _referral_ids(self, user):
        return self._get_ids(user, '/api/referrals/')

    def _ref_url(self, key):
        return f'/api/referrals/{self.referrals[key].id}/'


class C3RoleMatrixTests(C3Fixture, APITestCase):
    def _requests(self):
        # (label, method, url, payload, roles allowed, success status)
        return [
            ('dashboard', 'get', '/api/dashboard/', None, {'gh', 'sc'}, 200),
            ('referral-list', 'get', '/api/referrals/', None,
             {'rt', 'gh', 'wo'}, 200),
            ('referral-list POST', 'post', '/api/referrals/',
             self._referral_payload(self.l8a), {'rt'}, 201),
            ('referral-detail', 'get', self._ref_url('8A-own'), None,
             {'rt', 'gh', 'wo'}, 200),
            ('referral-detail PATCH', 'patch', self._ref_url('8A-own'),
             {'notes': 'Updated'}, {'gh', 'wo'}, 200),
            ('report-list', 'get', '/api/reports/', None,
             {'rt', 'gh', 'sc', 'wo'}, 200),
            ('generate-report', 'get', '/api/reports/generate/?type=all&format=csv',
             None, {'rt', 'gh', 'sc', 'wo'}, 200),
            # An empty payload proves permission was granted: the view's
            # own 400 is reached instead of the permission layer's 403.
            ('analyse-script', 'post', '/api/analyse-script/', {}, {'st'}, 400),
            ('generate-script-pdf', 'post', '/api/generate-script-pdf/', {},
             {'st'}, 400),
        ]

    def test_each_role_gets_exactly_the_endpoints_it_is_allowed(self):
        for label, method, url, payload, allowed, ok_status in self._requests():
            for key, user in self.users.items():
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, payload, format='json')
                expected = ok_status if key in allowed else status.HTTP_403_FORBIDDEN
                self.assertEqual(response.status_code, expected, f'{label} as {key}')

    def test_anonymous_caller_gets_401_everywhere(self):
        self.client.force_authenticate(user=None)
        for label, method, url, payload, _, _ in self._requests():
            response = getattr(self.client, method)(url, payload, format='json')
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, label)

    def test_denied_writes_for_every_role(self):
        writes = [
            ('delete', self._ref_url('8A-own'), None),
            ('post', '/api/reports/', {'report_type': 'x', 'parameters': {},
                                       'file_path': '', 'file_size_kb': 1}),
        ]
        counts_before = (Referral.objects.count(), Report.objects.count())
        for method, url, payload in writes:
            for key, user in self.users.items():
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, payload, format='json')
                self.assertIn(
                    response.status_code,
                    (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
                    f'{method.upper()} {url} as {key}',
                )
        self.assertEqual(counts_before, (Referral.objects.count(), Report.objects.count()))


class C3DashboardScopeTests(C3Fixture, APITestCase):
    def _stats(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_grade_head_counts_own_grade_only(self):
        data = self._stats(self.users['gh'])
        self.assertEqual(data['total_learners'], 2)
        self.assertEqual(data['unread_alerts'], 2)

    def test_school_clerk_counts_whole_school(self):
        data = self._stats(self.users['sc'])
        self.assertEqual(data['total_learners'], 3)
        self.assertEqual(data['unread_alerts'], 3)


class C3ReferralScopeTests(C3Fixture, APITestCase):
    def _ids(self, *keys):
        return {self.referrals[k].id for k in keys}

    def test_register_teacher_sees_only_referrals_they_made(self):
        self.assertEqual(self._referral_ids(self.users['rt']), self._ids('8A-own'))

    def test_grade_head_sees_own_grade(self):
        self.assertEqual(
            self._referral_ids(self.users['gh']), self._ids('8A-own', '8A-other', '8B')
        )

    def test_wellness_office_sees_whole_queue(self):
        self.assertEqual(
            self._referral_ids(self.users['wo']),
            self._ids('8A-own', '8A-other', '8B', '9A'),
        )

    def test_combined_roles_get_the_union(self):
        # Own referral (Register Teacher) plus grade 9 (Grade Head).
        UserRole.objects.create(
            user=self.other_rt, role=Role.objects.get(name=Role.GRADE_HEAD), grade_scope=9,
        )
        self.assertEqual(self._referral_ids(self.other_rt), self._ids('8A-other', '9A'))

    def test_wellness_office_who_is_also_register_teacher_still_sees_all(self):
        UserRole.objects.create(
            user=self.other_rt, role=Role.objects.get(name=Role.WELLNESS_OFFICE),
        )
        self.assertEqual(
            self._referral_ids(self.other_rt),
            self._ids('8A-own', '8A-other', '8B', '9A'),
        )

    def test_out_of_scope_referral_is_404(self):
        self.client.force_authenticate(user=self.users['rt'])
        self.assertEqual(
            self.client.get(self._ref_url('8A-other')).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(user=self.users['gh'])
        self.assertEqual(
            self.client.get(self._ref_url('9A')).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.client.patch(self._ref_url('9A'), {'notes': 'x'}, format='json').status_code,
            status.HTTP_404_NOT_FOUND,
        )


class C3ReferralWriteTests(C3Fixture, APITestCase):
    def test_register_teacher_post_ignores_assignee_status_and_referrer(self):
        rt = self.users['rt']
        self.client.force_authenticate(user=rt)
        response = self.client.post('/api/referrals/', self._referral_payload(
            self.l8a, assigned_to=self.users['wo'].id, status='Resolved',
            referred_by=self.users['sc'].id, resolution_notes='Closed',
        ), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        referral = Referral.objects.get(id=response.data['id'])
        self.assertEqual(referral.status, 'Open')
        self.assertIsNone(referral.assigned_to)
        self.assertEqual(referral.referred_by, rt)
        self.assertIsNone(referral.resolution_notes)

    def test_register_teacher_cannot_refer_a_learner_outside_own_class(self):
        self.client.force_authenticate(user=self.users['rt'])
        before = Referral.objects.count()
        response = self.client.post(
            '/api/referrals/', self._referral_payload(self.l8b), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['invalid_learner_ids'], [self.l8b.id])
        self.assertEqual(Referral.objects.count(), before)

    def test_assignee_must_hold_grade_head_or_wellness_office(self):
        self.client.force_authenticate(user=self.users['wo'])
        url = self._ref_url('8B')
        response = self.client.patch(url, {'assigned_to': self.users['rt'].id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.referrals['8B'].refresh_from_db()
        self.assertIsNone(self.referrals['8B'].assigned_to)

        response = self.client.patch(url, {'assigned_to': self.users['gh'].id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.referrals['8B'].refresh_from_db()
        self.assertEqual(self.referrals['8B'].assigned_to, self.users['gh'])

    def test_update_cannot_change_learner_or_referrer(self):
        self.client.force_authenticate(user=self.users['wo'])
        response = self.client.patch(self._ref_url('8A-own'), {
            'learner': self.l9a.id, 'referred_by': self.users['sc'].id, 'status': 'In_Progress',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        referral = self.referrals['8A-own']
        referral.refresh_from_db()
        self.assertEqual(referral.learner, self.l8a)
        self.assertEqual(referral.referred_by, self.users['rt'])
        self.assertEqual(referral.status, 'In_Progress')


class C3ReportTests(C3Fixture, APITestCase):
    def _report_csv(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/reports/generate/?type=all&format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.content.decode()

    def test_generate_report_is_limited_to_own_area(self):
        rt_csv = self._report_csv(self.users['rt'])
        self.assertIn('Eight-A', rt_csv)
        self.assertNotIn('Eight-B', rt_csv)
        gh_csv = self._report_csv(self.users['gh'])
        self.assertIn('Eight-A', gh_csv)
        self.assertIn('Eight-B', gh_csv)
        self.assertNotIn('Nine-A', gh_csv)
        sc_csv = self._report_csv(self.users['sc'])
        self.assertIn('Nine-A', sc_csv)

    def test_report_list_shows_only_own_reports(self):
        self.assertEqual(
            self._get_ids(self.users['rt'], '/api/reports/'), {self.reports['rt'].id}
        )
        self.assertEqual(
            self._get_ids(self.users['sc'], '/api/reports/'), {self.reports['sc'].id}
        )
        self.assertEqual(self._get_ids(self.users['gh'], '/api/reports/'), set())


class ReportFormatAndHistoryTests(C3Fixture, APITestCase):
    """
    FR17, NFR32 - the report format comes from file_format (format is a
    fallback), only pdf and csv are allowed, and every generated report
    leaves a Report row in the user's own history.
    """

    def _generate(self, user, query):
        self.client.force_authenticate(user=user)
        return self.client.get(f'/api/reports/generate/?{query}')

    def test_csv_request_returns_csv(self):
        response = self._generate(self.users['gh'], 'type=at_risk&file_format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response['Content-Type'].startswith('text/csv'))
        self.assertIn('earlysense_at_risk_report.csv', response['Content-Disposition'])

    def test_pdf_request_returns_pdf(self):
        response = self._generate(self.users['gh'], 'type=at_risk&file_format=pdf')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_unknown_format_is_400_and_records_nothing(self):
        before = Report.objects.count()
        response = self._generate(self.users['gh'], 'type=at_risk&file_format=docx')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Report.objects.count(), before)

    def test_generated_report_is_recorded_and_listed(self):
        gh = self.users['gh']
        response = self._generate(gh, 'type=all&file_format=csv&grade=8')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report = Report.objects.get(generated_by=gh)
        self.assertEqual(report.report_type, 'all')
        self.assertEqual(report.parameters, {'type': 'all', 'format': 'csv', 'grade': '8'})
        self.assertEqual(report.file_path, '')
        self.assertGreaterEqual(report.file_size_kb, 1)
        self.assertEqual(self._get_ids(gh, '/api/reports/'), {report.id})

    def test_another_users_reports_are_not_listed(self):
        self._generate(self.users['gh'], 'type=at_risk&file_format=pdf')
        gh_ids = set(
            Report.objects.filter(generated_by=self.users['gh']).values_list('id', flat=True)
        )
        rt_ids = self._get_ids(self.users['rt'], '/api/reports/')
        self.assertEqual(rt_ids, {self.reports['rt'].id})
        self.assertFalse(gh_ids & rt_ids)


class C3ScriptAnalysisScopeTests(C3Fixture, APITestCase):
    def test_out_of_scope_learner_is_404_before_any_analysis(self):
        self.client.force_authenticate(user=self.users['st'])
        response = self.client.post('/api/analyse-script/', {
            'learner_id': self.l8b.id,
            'subject': 'Maths',
            'assessment_name': 'Test 1',
            'script': SimpleUploadedFile('script.pdf', b'%PDF-1.4', 'application/pdf'),
            'memo': SimpleUploadedFile('memo.pdf', b'%PDF-1.4', 'application/pdf'),
            'question_paper': SimpleUploadedFile('qp.pdf', b'%PDF-1.4', 'application/pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ScriptAnalysisConsoleTests(C3Fixture, APITestCase):
    """
    NFR21, NFR23 - analyse_script writes no memo text, handwriting
    transcript or learner name to the console, returns no debug
    transcript, and sends no learner name to Groq. Both AI calls are mocked.
    """

    MEMO = 'MEMO-SECRET-Q1-ANSWER-42'
    TRANSCRIPT = 'TRANSCRIPT-SECRET-LEARNER-WROTE-41'

    def test_memo_transcript_and_name_are_not_printed(self):
        groq_response = MagicMock()
        groq_response.choices[0].finish_reason = 'stop'
        groq_response.choices[0].message.content = 'Analysis report'
        groq_client = MagicMock()
        groq_client.chat.completions.create.return_value = groq_response

        self.client.force_authenticate(user=self.users['st'])
        out = io.StringIO()
        with patch('core.views.extract_pdf_text', side_effect=['Question paper', self.MEMO]), \
                patch('core.views.transcribe_handwritten_script', return_value=self.TRANSCRIPT), \
                patch('groq.Groq', return_value=groq_client), \
                redirect_stdout(out):
            response = self.client.post('/api/analyse-script/', {
                'learner_id': self.l8a.id,
                'subject': 'Maths',
                'assessment_name': 'Test 1',
                'script': SimpleUploadedFile('script.pdf', b'%PDF-1.4', 'application/pdf'),
                'memo': SimpleUploadedFile('memo.pdf', b'%PDF-1.4', 'application/pdf'),
                'question_paper': SimpleUploadedFile('qp.pdf', b'%PDF-1.4', 'application/pdf'),
            }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        groq_client.chat.completions.create.assert_called_once()
        printed = out.getvalue()
        self.assertNotIn(self.MEMO, printed)
        self.assertNotIn(self.TRANSCRIPT, printed)
        self.assertNotIn(self.l8a.first_name, printed)
        self.assertNotIn('debug_transcript', response.data)
        prompt = groq_client.chat.completions.create.call_args.kwargs['messages'][0]['content']
        self.assertNotIn(self.l8a.first_name, prompt)


class AuditLogAdminReadOnlyTests(TestCase):
    """NFR21 - nobody, not even a superuser, can add, change or delete an audit row in the admin."""

    def test_superuser_cannot_add_change_or_delete(self):
        superuser = User.objects.create_superuser(
            username='admin_ro', email='admin_ro@example.com',
            password='testpass123', full_name='Admin RO',
        )
        request = RequestFactory().get('/admin/core/auditlog/')
        request.user = superuser
        log = AuditLog.objects.create(user=superuser, action='Login')

        self.assertIsInstance(admin.site._registry[AuditLog], AuditLogAdmin)
        model_admin = AuditLogAdmin(AuditLog, admin.site)
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request))
        self.assertFalse(model_admin.has_change_permission(request, log))
        self.assertFalse(model_admin.has_delete_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request, log))


# Open to all six roles by design, forever - not migrated later, never
# expected to gain a role-specific permission class.
OPEN_BY_DESIGN = {'login', 'token_refresh', 'current-user'}

# Not yet migrated to a role-specific permission class - these belong to
# phase (c2)/(c3), not (c1). This list must only ever shrink: remove an
# entry the moment that endpoint's permission_classes stops being bare
# IsAuthenticated/AllowAny/empty. See test_allow_list_is_not_stale below,
# which fails if an entry here has already been migrated and should have
# been removed.
NOT_YET_MIGRATED = set()


def _permission_classes_for(callback):
    view_class = getattr(callback, 'view_class', None) or getattr(callback, 'cls', None)
    return list(getattr(view_class, 'permission_classes', []))


def _has_no_role_specific_permission(classes):
    # Empty permission_classes is the least-protected state of all (DRF
    # treats no classes as nothing to deny on), so it counts as "no role
    # permission" too, not as something to silently pass.
    if not classes:
        return True
    return all(cls in (IsAuthenticated, AllowAny) for cls in classes)


class PermissionAuditTests(TestCase):
    """
    NFR16 - one central permission layer, deny by default, used by every
    endpoint. Scoped to backend/core/urls.py (the project's actual API
    surface) - Django's own /admin/ site isn't part of it and uses its own,
    separate permission mechanism (ModelAdmin/is_staff), not DRF
    permission_classes, so it can't be walked the same way.
    """

    def test_every_migrated_endpoint_has_an_explicit_role_permission(self):
        unprotected = []
        for pattern in core_urls.urlpatterns:
            name = pattern.name
            if name in OPEN_BY_DESIGN or name in NOT_YET_MIGRATED:
                continue
            classes = _permission_classes_for(pattern.callback)
            if _has_no_role_specific_permission(classes):
                unprotected.append(name)
        self.assertEqual(
            unprotected,
            [],
            f'These endpoints have no role-specific permission class: {unprotected}',
        )

    def test_allow_list_is_not_stale(self):
        wrongly_listed = []
        for pattern in core_urls.urlpatterns:
            name = pattern.name
            if name not in NOT_YET_MIGRATED:
                continue
            classes = _permission_classes_for(pattern.callback)
            if not _has_no_role_specific_permission(classes):
                wrongly_listed.append(name)
        self.assertEqual(
            wrongly_listed,
            [],
            'These endpoints are listed as not-yet-migrated but already '
            f'have a role-specific permission class - remove them from '
            f'NOT_YET_MIGRATED: {wrongly_listed}',
        )
