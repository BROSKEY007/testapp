"""Reproducible analysis behind the model choice. Run: python3 -I scripts/analysis/explore.py
Needs pandas, numpy, scipy, scikit-learn. Not required to run the API."""
import pandas as pd, numpy as np
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score
from scipy import stats

import os
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'nasa_sites.csv')
df = pd.read_csv(DATA)
df.columns = ['name','solar','swing','min_slope','max_slope','avg_slope','label']
print(df.shape, df.label.value_counts().to_dict())
print('missing:', df.isna().sum().sum(), '| min_slope unique:', df.min_slope.unique())
print('\n-- per class mean / median')
print(df.groupby('label')[['solar','swing','max_slope','avg_slope']].agg(['mean','median']).round(2).T)

print('\n-- univariate separation (AUC, Mann-Whitney p)')
for f in ['solar','swing','max_slope','avg_slope']:
    auc = roc_auc_score(df.label, df[f])
    p = stats.mannwhitneyu(df[df.label==1][f], df[df.label==0][f]).pvalue
    print(f'{f:10s} AUC={auc:.3f}  p={p:.3f}')

print('\n-- duplicate feature rows')
d = df[df.duplicated(['solar','swing'], keep=False)]
print(d[['name','solar','swing','max_slope','avg_slope','label']])

print('\n-- correlation')
print(df[['solar','swing','max_slope','avg_slope']].corr().round(2))

y = df.label.values
sets = {
 'all4': ['solar','swing','max_slope','avg_slope'],
 'solar+swing': ['solar','swing'],
 'swing only': ['swing'],
 'solar only': ['solar'],
 'slopes': ['max_slope','avg_slope'],
 'swing+avg_slope': ['swing','avg_slope'],
}
models = {
 'logreg C=1': lambda: make_pipeline(StandardScaler(), LogisticRegression(C=1.0)),
 'logreg C=0.3': lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3)),
 'gaussianNB': lambda: make_pipeline(StandardScaler(), GaussianNB()),
 'kNN k=5': lambda: make_pipeline(StandardScaler(), KNeighborsClassifier(5)),
 'tree d=2': lambda: DecisionTreeClassifier(max_depth=2, random_state=0),
}
print('\n-- leave-one-out CV (n=30). Majority baseline = 0.50')
rows=[]
for sn, cols in sets.items():
    X = df[cols].values
    for mn, mk in models.items():
        pr = cross_val_predict(mk(), X, y, cv=LeaveOneOut(), method='predict_proba')[:,1]
        rows.append((sn, mn, accuracy_score(y, pr>0.5), roc_auc_score(y, pr)))
r = pd.DataFrame(rows, columns=['features','model','acc','auc']).sort_values('acc', ascending=False)
print(r.head(12).round(3).to_string(index=False))
print('...worst:'); print(r.tail(3).round(3).to_string(index=False))

# permutation test for the best one: how often does shuffled-label LOO reach this accuracy
best = r.iloc[0]
cols = sets[best.features]; X = df[cols].values
rng = np.random.default_rng(0); hits=0; N=300
for _ in range(N):
    ys = rng.permutation(y)
    pr = cross_val_predict(models[best.model](), X, ys, cv=LeaveOneOut(), method='predict_proba')[:,1]
    hits += accuracy_score(ys, pr>0.5) >= best.acc
print(f'\npermutation p-value for best ({best.features}, {best.model}, acc={best.acc:.3f}): {hits/N:.3f}')
