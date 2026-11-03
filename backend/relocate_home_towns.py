"""
Run with: python relocate_home_towns.py           (dry run, changes nothing)
          python relocate_home_towns.py --apply   (writes the changes)

Moves learners whose home_town is not a place on the Risk Map (for example
the old Kuruman-area towns) to the Kimberley place whose straight-line
distance from the school is closest to the learner's stored distance_km.
distance_km is never changed. Learners already in a map place are left alone.
"""
import os
import sys
import django
from collections import Counter
from math import radians, sin, cos, asin, sqrt

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from core.models import Learner, AuditLog

# Same points as frontend/src/pages/MapView.jsx (OpenStreetMap, Nominatim)
KBHS_POSITION_OSM = (-28.7492013, 24.7698827)
TOWN_COORDS = {
    'Galeshewe': (-28.723657, 24.7473964),
    'Roodepan': (-28.6648059, 24.7168903),
    'Homevale': (-28.6970686, 24.7320414),
    'Platfontein': (-28.7063157, 24.6454247),
    'Greenpoint': (-28.7749574, 24.7689887),
    'Beaconsfield': (-28.7515345, 24.7884106),
    'Hadison Park': (-28.7539295, 24.7419397),
    'Floors': (-28.7181022, 24.7652032),
    'Kimberley': (-28.73833, 24.76389),
}


def km_between(a, b):
    lat1, lng1, lat2, lng2 = map(radians, (*a, *b))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371.0088 * asin(sqrt(h))


# Place -> distance from the school, nearest first
PLACE_DISTANCE_KM = dict(sorted(
    ((town, round(km_between(KBHS_POSITION_OSM, coords), 2)) for town, coords in TOWN_COORDS.items()),
    key=lambda item: item[1],
))


def on_map(home_town):
    # Same match as MapView: the town name appears in home_town, any case
    value = (home_town or '').lower()
    return any(town.lower() in value for town in TOWN_COORDS)


def nearest_place(distance_km):
    return min(PLACE_DISTANCE_KM, key=lambda town: abs(PLACE_DISTANCE_KM[town] - float(distance_km)))


apply_changes = '--apply' in sys.argv

print('Mapping (place -> km from Kimberley Boys High School):')
for town, km in PLACE_DISTANCE_KM.items():
    print(f"  {town:<14} {km:6.2f} km")

learners = list(Learner.objects.all().order_by('id'))
to_move = [(l, nearest_place(l.distance_km)) for l in learners if not on_map(l.home_town)]

moves = Counter((l.home_town, new_town) for l, new_town in to_move)
print(f"\nLearners: {len(learners)} total, {len(learners) - len(to_move)} already on the map, {len(to_move)} to move")
print('\nOld home_town -> new home_town: learners')
for (old_town, new_town), count in sorted(moves.items()):
    print(f"  {old_town or '(blank)'} -> {new_town}: {count}")
print('\nNew home_town totals:')
for town, count in Counter(new_town for _, new_town in to_move).most_common():
    print(f"  {town}: {count}")

if not apply_changes:
    print('\nDry run only. Nothing was changed. Run with --apply to write these changes.')
    sys.exit(0)

with transaction.atomic():
    for learner, new_town in to_move:
        learner.home_town = new_town
        learner.save(update_fields=['home_town'])
    # One summary row for the whole run, not one per learner
    if to_move:
        AuditLog.objects.create(
            user=None,
            action='Relocate_Home_Town',
            target_type='Learner',
        )

print(f"\nApplied: {len(to_move)} learners moved. distance_km was not changed.")
