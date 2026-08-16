"""
Run with: python seed_data.py
This creates sample learners, attendance, marks and incidents
so you can test EarlySense end to end.
"""
import os
import django
import random
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User, Learner, AttendanceRecord, MarkRecord, Incident, RiskScore, Alert

print("Clearing old sample data...")
Learner.objects.all().delete()

print("Creating learners...")

learners_data = [
    # High Risk Learners
    {
        'sasams_id': '2024001', 'first_name': 'Amahle', 'surname': 'Dube',
        'date_of_birth': date(2010, 3, 14), 'grade': 9, 'class_group': '9B',
        'gender': 'Female', 'home_town': 'Bankhara Bodulong',
        'distance_km': 12.5, 'guardian_name': 'S. Dube',
        'guardian_phone': '0762345678', 'income_index': 1,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.54, 'avg_mark': 38, 'incidents': 4,
    },
    {
        'sasams_id': '2024002', 'first_name': 'Sipho', 'surname': 'Mthembu',
        'date_of_birth': date(2009, 7, 22), 'grade': 10, 'class_group': '10A',
        'gender': 'Male', 'home_town': 'Wrenchville',
        'distance_km': 15.2, 'guardian_name': 'T. Mthembu',
        'guardian_phone': '0731234567', 'income_index': 1,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.61, 'avg_mark': 42, 'incidents': 3,
    },
    {
        'sasams_id': '2024003', 'first_name': 'Thabo', 'surname': 'Nkosi',
        'date_of_birth': date(2011, 1, 5), 'grade': 8, 'class_group': '8C',
        'gender': 'Male', 'home_town': 'Galeshewe',
        'distance_km': 18.0, 'guardian_name': 'M. Nkosi',
        'guardian_phone': '0829876543', 'income_index': 1,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.57, 'avg_mark': 35, 'incidents': 5,
    },
    # Medium Risk Learners
    {
        'sasams_id': '2024004', 'first_name': 'Lerato', 'surname': 'Sithole',
        'date_of_birth': date(2010, 9, 18), 'grade': 9, 'class_group': '9C',
        'gender': 'Female', 'home_town': 'Mothibistad',
        'distance_km': 8.3, 'guardian_name': 'P. Sithole',
        'guardian_phone': '0641234567', 'income_index': 2,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.69, 'avg_mark': 51, 'incidents': 2,
    },
    {
        'sasams_id': '2024005', 'first_name': 'Nokwanda', 'surname': 'Zulu',
        'date_of_birth': date(2009, 11, 30), 'grade': 10, 'class_group': '10B',
        'gender': 'Female', 'home_town': 'Kuruman',
        'distance_km': 6.1, 'guardian_name': 'B. Zulu',
        'guardian_phone': '0711234567', 'income_index': 2,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.72, 'avg_mark': 48, 'incidents': 2,
    },
    {
        'sasams_id': '2024006', 'first_name': 'Bongani', 'surname': 'Khumalo',
        'date_of_birth': date(2011, 4, 12), 'grade': 8, 'class_group': '8A',
        'gender': 'Male', 'home_town': 'Bankhara Bodulong',
        'distance_km': 11.0, 'guardian_name': 'L. Khumalo',
        'guardian_phone': '0791234567', 'income_index': 2,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.71, 'avg_mark': 53, 'incidents': 1,
    },
    # Low Risk Learners
    {
        'sasams_id': '2024007', 'first_name': 'Naledi', 'surname': 'Mokoena',
        'date_of_birth': date(2010, 6, 25), 'grade': 9, 'class_group': '9A',
        'gender': 'Female', 'home_town': 'Kuruman',
        'distance_km': 2.5, 'guardian_name': 'D. Mokoena',
        'guardian_phone': '0761111111', 'income_index': 3,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.92, 'avg_mark': 78, 'incidents': 0,
    },
    {
        'sasams_id': '2024008', 'first_name': 'Lethabo', 'surname': 'Motsei',
        'date_of_birth': date(2009, 8, 14), 'grade': 10, 'class_group': '10A',
        'gender': 'Male', 'home_town': 'Kuruman',
        'distance_km': 1.8, 'guardian_name': 'K. Motsei',
        'guardian_phone': '0762222222', 'income_index': 4,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.95, 'avg_mark': 82, 'incidents': 0,
    },
    {
        'sasams_id': '2024009', 'first_name': 'Keabetswe', 'surname': 'Tlhapi',
        'date_of_birth': date(2011, 2, 8), 'grade': 8, 'class_group': '8B',
        'gender': 'Female', 'home_town': 'Kuruman',
        'distance_km': 3.2, 'guardian_name': 'R. Tlhapi',
        'guardian_phone': '0763333333', 'income_index': 3,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.88, 'avg_mark': 71, 'incidents': 0,
    },
    {
        'sasams_id': '2024010', 'first_name': 'Tebogo', 'surname': 'Setshedi',
        'date_of_birth': date(2008, 5, 19), 'grade': 11, 'class_group': '11A',
        'gender': 'Male', 'home_town': 'Kuruman',
        'distance_km': 4.0, 'guardian_name': 'N. Setshedi',
        'guardian_phone': '0764444444', 'income_index': 3,
        'enrolled_date': date(2024, 1, 15),
        'attendance_rate': 0.85, 'avg_mark': 67, 'incidents': 1,
    },
]

subjects = ['Mathematics', 'English', 'Life Science', 'Geography', 'History']
incident_types = ['Truancy', 'Disruptive Behaviour', 'Late Arrival', 'Aggressive Behaviour', 'Misconduct']

admin_user = User.objects.filter(username='ikho').first()
start_date = date(2026, 1, 15)
total_school_days = 80

for data in learners_data:
    # Create learner
    learner = Learner.objects.create(
        sasams_id=data['sasams_id'],
        first_name=data['first_name'],
        surname=data['surname'],
        date_of_birth=data['date_of_birth'],
        grade=data['grade'],
        class_group=data['class_group'],
        gender=data['gender'],
        home_town=data['home_town'],
        distance_km=data['distance_km'],
        guardian_name=data['guardian_name'],
        guardian_phone=data['guardian_phone'],
        income_index=data['income_index'],
        enrolled_date=data['enrolled_date'],
    )

    # Create attendance records
    present_days = int(total_school_days * data['attendance_rate'])
    absent_days = total_school_days - present_days
    attendance_list = [True] * present_days + [False] * absent_days
    random.shuffle(attendance_list)

    current_date = start_date
    for is_present in attendance_list:
        # Skip weekends
        while current_date.weekday() >= 5:
            current_date += timedelta(days=1)
        AttendanceRecord.objects.create(
            learner=learner,
            date=current_date,
            is_present=is_present,
            recorded_by=admin_user,
        )
        current_date += timedelta(days=1)

    # Create mark records
    for subject in subjects:
        for term in [1, 2]:
            base_mark = data['avg_mark']
            variation = random.uniform(-10, 10)
            mark = max(5, min(100, base_mark + variation))
            MarkRecord.objects.create(
                learner=learner,
                subject=subject,
                assessment_type='Test',
                mark=round(mark, 1),
                max_mark=100,
                term=term,
                assessment_date=date(2026, 2 if term == 1 else 4, random.randint(1, 28)),
                recorded_by=admin_user,
            )

    # Create incidents
    for i in range(data['incidents']):
        Incident.objects.create(
            learner=learner,
            incident_date=date(2026, random.randint(1, 5), random.randint(1, 28)),
            incident_type=random.choice(incident_types),
            description=f'Incident reported by class teacher.',
            severity=random.choice(['Low', 'Medium', 'High']),
            logged_by=admin_user,
        )

    print(f"Created: {learner}")

print(f"\nCreated {len(learners_data)} learners with attendance, marks and incidents!")
print("Now running ML predictions...")

# Run ML predictions for all learners
from core.ml_engine import predict_all_learners
results = predict_all_learners()

print(f"\nDone! EarlySense is ready to use.")
print("\nRisk Summary:")
for r in results:
    print(f"  {r['learner']} -> {r['risk_level']} ({r['risk_score']:.0%})")