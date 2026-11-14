"""Reproducible analysis behind the model choice. Run: python3 -I scripts/analysis/honest.py
Needs pandas, numpy, scipy, scikit-learn. Not required to run the API.

The dataset now has 16 numeric parameters for 30 sites. This script reports:
  1) the shipped model (all 16 parameters, ridge logistic regression C=1) under leave-one-out,
  2) the earlier 4-parameter model for comparison,
  3) nested leave-one-out over a small declared candidate set, so model selection is included.
"""
import os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score, accuracy_score

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'nasa_sites.csv')
df = pd.read_csv(DATA)
y = df.label.values

ORIG4 = ['avg_solar_kwh_m2_day', 'max_temp_swing_c', 'max_slope_deg', 'avg_slope_deg']
ALL = ORIG4 + ['mean_annual_precip_mm', 'mean_annual_pet_mm', 'aridity_index', 'max_wind_speed_ms',
               'peak_wind_2021_2025_ms', 'Max_TRI', 'Mean_TRI', 'Max_TWI', 'Mean_TWI',
               'Mean_surface_albedo', 'Mean_insolation(kWh/m^2/day)', 'ndvi']
# Not features: lat, lon (identity), years_used (constant), label (target), text columns.

def lr(C=1.0):  return make_pipeline(SimpleImputer(strategy='mean'), StandardScaler(), LogisticRegression(C=C, max_iter=1000))
def tree():     return make_pipeline(SimpleImputer(strategy='mean'), DecisionTreeClassifier(max_depth=2, random_state=0))
def knn():      return make_pipeline(SimpleImputer(strategy='mean'), StandardScaler(), KNeighborsClassifier(5))

def loo(mk, cols):
    return cross_val_predict(mk(), df[cols].values, y, cv=LeaveOneOut(), method='predict_proba')[:, 1]

# 1) and 2) fixed, pre-declared models
for name, cols in [('all 16 parameters (shipped)', ALL), ('original 4 parameters', ORIG4)]:
    pr = loo(lr, cols)
    print(f'{name:30s} LOO acc={accuracy_score(y, pr > .5):.3f} AUC={roc_auc_score(y, pr):.3f}')

# 3) nested LOO: pick (feature set, model) on the 29 training sites only, then test on the held-out site
cands = [(cols, nm, mk) for cols in (ALL, ORIG4)
         for nm, mk in (('lr C=1', lambda: lr(1.0)), ('lr C=0.1', lambda: lr(0.1)), ('tree', tree), ('knn5', knn))]
print('\ncandidate configs searched:', len(cands))
correct = 0
for i in range(len(df)):
    tr = np.arange(len(df)) != i
    Xtr, ytr = df.loc[tr], y[tr]
    best = (-1, None)
    for cols, _, mk in cands:
        pr = cross_val_predict(mk(), Xtr[cols].values, ytr, cv=LeaveOneOut(), method='predict_proba')[:, 1]
        a = accuracy_score(ytr, pr > .5)
        if a > best[0]: best = (a, (cols, mk))
    cols, mk = best[1]
    correct += int(mk().fit(Xtr[cols].values, ytr).predict(df.loc[[i], cols].values)[0] == y[i])
print(f'NESTED LOO accuracy (selection included) = {correct / len(df):.3f}')

# 4) final model: standardised coefficients and the sites it gets wrong when held out
m = lr().fit(df[ALL].values, y)
coefs = m.named_steps['logisticregression'].coef_[0]
print('\nfinal model (all 16 parameters), standardised coefficients:')
for f, c in sorted(zip(ALL, coefs), key=lambda t: -abs(t[1])): print(f'  {f:32s} {c:+.3f}')
pr = loo(lr, ALL)
df['p_good'] = pr.round(2); df['pred'] = (pr > .5).astype(int)
print('\nmisclassified in LOO:')
print(df[df.pred != df.label][['location', 'label', 'p_good']].to_string(index=False))
rng = np.random.default_rng(1)
ok = (df.pred == df.label).values
print('\nLOO accuracy 95% bootstrap CI:', np.percentile([rng.choice(ok, len(ok)).mean() for _ in range(5000)], [2.5, 97.5]).round(3))
