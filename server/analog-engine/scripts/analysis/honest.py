"""Reproducible analysis behind the model choice. Run: python3 -I scripts/analysis/honest.py
Needs pandas, numpy, scipy, scikit-learn. Not required to run the API."""
import pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score
import itertools

import os
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'nasa_sites.csv')
df = pd.read_csv(DATA)
df.columns = ['name','solar','swing','min_slope','max_slope','avg_slope','label']
F = ['solar','swing','max_slope']          # avg_slope: AUC .54, adds nothing alone; test with it below
F4 = ['solar','swing','max_slope','avg_slope']
y = df.label.values

# 1) Fixed, pre-declared model (no selection): logreg C=1, standardized
def logreg(): return make_pipeline(StandardScaler(), LogisticRegression(C=1.0))
for name, cols in [('solar+swing+max_slope', F), ('all 4 numeric', F4)]:
    pr = cross_val_predict(logreg(), df[cols].values, y, cv=LeaveOneOut(), method='predict_proba')[:,1]
    print(f'{name:24s} LOO acc={accuracy_score(y,pr>.5):.3f} AUC={roc_auc_score(y,pr):.3f}')

# 2) Nested LOO: choose (feature set, model) on the 29 training sites only, test on the held out one
cands=[]
for k in (1,2,3,4):
    for cols in itertools.combinations(F4,k):
        cands.append((cols,'lr',lambda: make_pipeline(StandardScaler(), LogisticRegression(C=1.0))))
        cands.append((cols,'tree',lambda: DecisionTreeClassifier(max_depth=2, random_state=0)))
        cands.append((cols,'knn',lambda: make_pipeline(StandardScaler(), KNeighborsClassifier(5))))
print('candidate configs searched:', len(cands))
correct=0
for i in range(len(df)):
    tr = np.arange(len(df))!=i
    Xtr, ytr = df.loc[tr], y[tr]
    best=(-1,None)
    for cols,_,mk in cands:
        pr = cross_val_predict(mk(), Xtr[list(cols)].values, ytr, cv=LeaveOneOut(), method='predict_proba')[:,1]
        a = accuracy_score(ytr, pr>.5)
        if a>best[0]: best=(a,(cols,mk))
    cols,mk = best[1]
    m = mk().fit(Xtr[list(cols)].values, ytr)
    correct += int(m.predict(df.loc[[i],list(cols)].values)[0]==y[i])
print(f'NESTED LOO accuracy (selection included) = {correct/len(df):.3f}')

# 3) Final model: coefficients & per-site LOO predictions
m = logreg().fit(df[F].values, y)
lr = m.named_steps['logisticregression']; sc = m.named_steps['standardscaler']
print('\nfinal model (solar, swing, max_slope):')
for f,c,mu,sd in zip(F, lr.coef_[0], sc.mean_, sc.scale_): print(f'  {f:10s} coef(std)={c:+.3f}  mean={mu:.3f} sd={sd:.3f}')
print('  intercept', round(lr.intercept_[0],3))
pr = cross_val_predict(logreg(), df[F].values, y, cv=LeaveOneOut(), method='predict_proba')[:,1]
df['p_good']=pr.round(2); df['pred']=(pr>.5).astype(int)
print('\nmisclassified in LOO:')
print(df[df.pred!=df.label][['name','solar','swing','max_slope','label','p_good']].to_string(index=False))
# bootstrap CI for LOO accuracy
rng=np.random.default_rng(1); acc=[]
ok=(df.pred==df.label).values
for _ in range(5000): acc.append(rng.choice(ok, len(ok)).mean())
print('\nLOO accuracy 95% bootstrap CI:', np.percentile(acc,[2.5,97.5]).round(3))
