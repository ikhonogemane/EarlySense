import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import pickle
import os
from django.conf import settings

# ─── PATH WHERE MODEL IS SAVED ───────────────────────────
MODEL_PATH = os.path.join(settings.BASE_DIR, 'core', 'ml_model.pkl')

# ─── FEATURE NAMES ───────────────────────────────────────
FEATURES = [
    'attendance_rate',
    'avg_mark',
    'mark_trend',
    'incident_count',
    'distance_km',
    'income_index',
]


# ─── GENERATE SYNTHETIC TRAINING DATA ────────────────────
def generate_training_data(n_samples=500):
    """
    Generates realistic synthetic learner data based on
    South African dropout research patterns.
    """
    np.random.seed(42)
    data = []

    # High Risk — 30% of learners
    n_high = int(n_samples * 0.30)
    for _ in range(n_high):
        data.append({
            'attendance_rate': np.random.uniform(30, 60),
            'avg_mark':        np.random.uniform(20, 45),
            'mark_trend':      np.random.uniform(-30, -5),
            'incident_count':  np.random.randint(3, 8),
            'distance_km':     np.random.uniform(8, 25),
            'income_index':    np.random.randint(1, 3),
            'risk_level':      'High'
        })

    # Medium Risk — 30% of learners
    n_medium = int(n_samples * 0.30)
    for _ in range(n_medium):
        data.append({
            'attendance_rate': np.random.uniform(60, 76),
            'avg_mark':        np.random.uniform(40, 56),
            'mark_trend':      np.random.uniform(-15, 5),
            'incident_count':  np.random.randint(1, 4),
            'distance_km':     np.random.uniform(4, 12),
            'income_index':    np.random.randint(1, 4),
            'risk_level':      'Medium'
        })

    # Low Risk — 40% of learners
    n_low = n_samples - n_high - n_medium
    for _ in range(n_low):
        data.append({
            'attendance_rate': np.random.uniform(75, 100),
            'avg_mark':        np.random.uniform(50, 95),
            'mark_trend':      np.random.uniform(-5, 20),
            'incident_count':  np.random.randint(0, 2),
            'distance_km':     np.random.uniform(0.5, 8),
            'income_index':    np.random.randint(2, 5),
            'risk_level':      'Low'
        })

    return pd.DataFrame(data)


# ─── TRAIN THE MODEL ─────────────────────────────────────
def train_model():
    """
    Trains the Random Forest model on synthetic data
    and saves it to disk as ml_model.pkl
    """
    print("Generating training data...")
    df = generate_training_data(500)

    # Separate features (X) from labels (y)
    X = df[FEATURES]
    y = df['risk_level']

    # Split into training set (80%) and test set (20%)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Create the Random Forest model
    # n_estimators=100 means 100 decision trees
    # class_weight='balanced' handles imbalanced data
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        class_weight='balanced',
        random_state=42
    )

    print("Training Random Forest model...")
    model.fit(X_train, y_train)

    # Evaluate on test set
    y_pred = model.predict(X_test)
    print("\nModel Performance:")
    print(classification_report(y_test, y_pred))

    # Show feature importance
    importances = pd.Series(
        model.feature_importances_,
        index=FEATURES
    ).sort_values(ascending=False)
    print("\nFeature Importance:")
    print(importances)

    # Save model to disk
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to {MODEL_PATH}")

    return model


# ─── LOAD THE MODEL ──────────────────────────────────────
def load_model():
    """
    Loads the saved model from disk.
    If no model exists yet, trains a new one first.
    """
    if not os.path.exists(MODEL_PATH):
        print("No model found — training new model...")
        return train_model()

    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    return model


# ─── COMPUTE LEARNER FEATURES ────────────────────────────
def compute_features(learner):
    """
    Takes a Learner object from the database and
    calculates their 6 ML features from related records.
    """
    from .models import AttendanceRecord, MarkRecord, Incident

    # 1. Attendance rate
    total_days = AttendanceRecord.objects.filter(
        learner=learner
    ).count()

    present_days = AttendanceRecord.objects.filter(
        learner=learner,
        is_present=True
    ).count()

    attendance_rate = (
        (present_days / total_days * 100)
        if total_days > 0 else 70.0
    )

    # 2. Average mark
    marks = MarkRecord.objects.filter(learner=learner)
    if marks.exists():
        avg_mark = float(
            marks.aggregate(avg=__import__('django.db.models', fromlist=['Avg']).Avg('mark'))['avg']
            or 50.0
        )
    else:
        avg_mark = 50.0

    # 3. Mark trend (difference between latest and previous term)
    term1_marks = marks.filter(term=1)
    term2_marks = marks.filter(term=2)

    if term1_marks.exists() and term2_marks.exists():
        from django.db.models import Avg
        t1_avg = float(term1_marks.aggregate(avg=Avg('mark'))['avg'] or 0)
        t2_avg = float(term2_marks.aggregate(avg=Avg('mark'))['avg'] or 0)
        mark_trend = t2_avg - t1_avg
    else:
        mark_trend = 0.0

    # 4. Incident count this term
    incident_count = Incident.objects.filter(learner=learner).count()

    # 5. Distance from home to school
    distance_km = float(learner.distance_km)

    # 6. Household income index
    income_index = learner.income_index

    return {
        'attendance_rate': attendance_rate,
        'avg_mark':        avg_mark,
        'mark_trend':      mark_trend,
        'incident_count':  incident_count,
        'distance_km':     distance_km,
        'income_index':    income_index,
    }


# ─── PREDICT RISK FOR ONE LEARNER ────────────────────────
def predict_risk(learner):
    """
    Takes a Learner object, computes their features,
    runs the ML model, and returns the prediction.
    """
    from .models import RiskScore, Alert

    model = load_model()
    features = compute_features(learner)

    # Convert to DataFrame for the model
    X = pd.DataFrame([features])

    # Get probability scores for each class
    probabilities = model.predict_proba(X)[0]
    classes = model.classes_

    # Get the predicted class and its probability
    predicted_class = model.predict(X)[0]
    class_index = list(classes).index(predicted_class)
    risk_score = float(probabilities[class_index])

    # Find the top contributing feature
    importances = model.feature_importances_
    top_feature_index = importances.argmax()
    top_factor = FEATURES[top_feature_index]

    # FR10: the level before this run, read before the new score is saved
    previous = RiskScore.objects.filter(learner=learner).order_by('-computed_date', '-id').first()
    level_changed = previous is None or previous.risk_level != predicted_class

    # Save the risk score to the database
    RiskScore.objects.create(
        learner=learner,
        attendance_rate=features['attendance_rate'],
        avg_mark=features['avg_mark'],
        mark_trend=features['mark_trend'],
        incident_count=features['incident_count'],
        risk_score=risk_score,
        risk_level=predicted_class,
        top_factor=top_factor,
    )

    # Create an alert if Medium or High risk and the level changed
    if predicted_class in ['Medium', 'High'] and level_changed:
        Alert.objects.create(
            learner=learner,
            alert_type='Risk_Level_Change',
            message=(
                f'{learner.first_name} {learner.surname} has been classified as '
                f'{predicted_class} Risk (score: {risk_score:.0%}). '
                f'Primary factor: {top_factor.replace("_", " ").title()}.'
            )
        )
        # Send email notification
        send_risk_alert_email(
            learner=learner,
            risk_level=predicted_class,
            risk_score=risk_score,
            top_factor=top_factor,
        )

    return {
        'risk_level':  predicted_class,
        'risk_score':  risk_score,
        'top_factor':  top_factor,
        'features':    features,
    }


# ─── PREDICT RISK FOR ALL LEARNERS ───────────────────────
def predict_all_learners():
    """
    Runs the ML prediction for every active learner
    in the database. Called after a CSV import.
    """
    from .models import Learner

    learners = Learner.objects.filter(is_active=True)
    results = []

    for learner in learners:
        result = predict_risk(learner)
        results.append({
            'learner': str(learner),
            **result
        })

    print(f"\nCompleted scoring for {len(results)} learners")
    return results

# ─── SEND RISK ALERT EMAIL ───────────────────────────────
def send_risk_alert_email(learner, risk_level, risk_score, top_factor):
    """
    Sends an email alert when a learner is classified
    as Medium or High risk.
    """
    from django.core.mail import send_mail
    from django.conf import settings
    from .models import Learner, User
    from .permissions import ALERT_ROLES, scope_queryset

    # FR10, NFR17: only active Register Teachers, Subject Teachers and
    # Grade Heads whose UserRole scope covers this learner
    candidates = User.objects.filter(
        is_active=True,
        userrole__role__name__in=ALERT_ROLES,
    ).distinct()
    this_learner = Learner.objects.filter(pk=learner.pk)
    recipients = [
        user.email for user in candidates
        if user.email and scope_queryset(this_learner, user, ALERT_ROLES).exists()
    ]

    if not recipients:
        print("No recipients found for email alert")
        return

    subject = f"EarlySense Alert: {learner.first_name} {learner.surname} — {risk_level} Risk"

    message = f"""
Dear Educator,

EarlySense has identified a learner who may be at risk of dropping out.

LEARNER DETAILS:
Name:        {learner.first_name} {learner.surname}
Grade:       {learner.grade} — {learner.class_group}

RISK ASSESSMENT:
Risk Level:  {risk_level}
Risk Score:  {risk_score:.0%}
Top Factor:  {top_factor.replace('_', ' ').title()}

RECOMMENDED ACTION:
{"Immediate intervention required. Please create a referral to the Learner Support Team." if risk_level == "High" else "Please monitor this learner closely and consider a referral if the situation does not improve."}

Please log in to EarlySense to view the full learner profile and take action:
http://localhost:5173/

This is an automated alert generated by the EarlySense AI system.
Sol Plaatje University — CSIT Department

---
This email was sent by EarlySense. Do not reply to this email.
    """.strip()

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=list(recipients),
            fail_silently=False,
        )
        print(f"Email alert sent to {len(recipients)} recipient(s)")
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False