"""Exploration behind the model choice. Run: python3 -I scripts/analysis/explore.py
Needs pandas, numpy, scipy, scikit-learn. Not required to run the API.
Uses all 16 numeric parameters in the dataset (missing NDVI is mean-imputed inside each fold)."""
import os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score, accuracy_score
from scipy import stats

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'nasa_sites.csv')
df = pd.read_csv(DATA).rename(columns={
    'avg_solar_kwh_m2_day': 'solar', 'max_temp_swing_c': 'swing', 'mean_annual_precip_mm': 'precip',
    'mean_annual_pet_mm': 'pet', 'max_wind_speed_ms': 'wind_max', 'peak_wind_2021_2025_ms': 'wind_peak',
    'Mean_surface_albedo': 'albedo', 'Mean_insolation(kWh/m^2/day)': 'insol'})
df.columns = [c.lower() for c in df.columns]
y = df.label.values
ALL = ['solar', 'swing', 'max_slope_deg', 'avg_slope_deg', 'precip', 'pet', 'aridity_index', 'wind_max', 'wind_peak',
       'max_tri', 'mean_tri', 'max_twi', 'mean_twi', 'albedo', 'insol', 'ndvi']
print(df.shape, df.label.value_counts().to_dict(), '| missing values:', df[ALL].isna().sum().sum(), '(ndvi, McMurdo)')

print('\n-- univariate separation (AUC, Mann-Whitney p), all 16 parameters')
rows = []
for f in ALL:
    v = df[[f, 'label']].dropna()
    rows.append((f, roc_auc_score(v.label, v[f]), stats.mannwhitneyu(v[v.label == 1][f], v[v.label == 0][f]).pvalue))
print(pd.DataFrame(rows, columns=['feature', 'AUC', 'p']).sort_values('AUC', key=lambda s: (s - .5).abs(), ascending=False).round(3).to_string(index=False))

print('\n-- highly correlated pairs (|r| > 0.9): these carry almost the same information')
c = df[ALL].corr().abs()
for i in ALL:
    for j in ALL:
        if i < j and c.loc[i, j] > 0.9: print(f'  {i} / {j}: {c.loc[i, j]:.3f}')

print('\n-- identical values between different sites on a continuous feature (possible copy errors)')
for f in ALL:
    if df[f].nunique() < 0.95 * df[f].notna().sum(): continue
    d = df[df.duplicated(f, keep=False) & df[f].notna()]
    if len(d): print(f'  {f}:', d.location.tolist())

sets = {
    'all16': ALL,
    'orig4': ['solar', 'swing', 'max_slope_deg', 'avg_slope_deg'],
    'terrain': ['max_slope_deg', 'avg_slope_deg', 'max_tri', 'mean_tri', 'max_twi', 'mean_twi'],
    'climate+veg': ['precip', 'pet', 'aridity_index', 'ndvi', 'albedo'],
    'solar+insol': ['solar', 'insol'],
}
imp = lambda: SimpleImputer(strategy='mean')
models = {
    'logreg C=1': lambda: make_pipeline(imp(), StandardScaler(), LogisticRegression(C=1.0, max_iter=1000)),
    'logreg C=0.3': lambda: make_pipeline(imp(), StandardScaler(), LogisticRegression(C=0.3, max_iter=1000)),
    'gaussianNB': lambda: make_pipeline(imp(), StandardScaler(), GaussianNB()),
    'kNN k=5': lambda: make_pipeline(imp(), StandardScaler(), KNeighborsClassifier(5)),
    'tree d=2': lambda: make_pipeline(imp(), DecisionTreeClassifier(max_depth=2, random_state=0)),
}
print('\n-- leave-one-out CV (n=30). Majority baseline = 0.50')
rows = []
for sn, cols in sets.items():
    X = df[cols].values
    for mn, mk in models.items():
        pr = cross_val_predict(mk(), X, y, cv=LeaveOneOut(), method='predict_proba')[:, 1]
        rows.append((sn, mn, accuracy_score(y, pr > 0.5), roc_auc_score(y, pr)))
r = pd.DataFrame(rows, columns=['features', 'model', 'acc', 'auc']).sort_values('acc', ascending=False)
print(f'({len(rows)} variants tried)')
print(r.head(12).round(3).to_string(index=False))
print('...worst:'); print(r.tail(3).round(3).to_string(index=False))

# permutation test for the shipped model: how often does shuffled-label LOO reach its accuracy
cols = ALL; X = df[cols].values
acc = r[(r.features == 'all16') & (r.model == 'logreg C=1')].acc.iloc[0]
rng = np.random.default_rng(0); hits = 0; N = 300
for _ in range(N):
    ys = rng.permutation(y)
    pr = cross_val_predict(models['logreg C=1'](), X, ys, cv=LeaveOneOut(), method='predict_proba')[:, 1]
    hits += accuracy_score(ys, pr > 0.5) >= acc
print(f'\npermutation p-value for shipped model (all16, logreg C=1, acc={acc:.3f}): {hits / N:.3f}')
