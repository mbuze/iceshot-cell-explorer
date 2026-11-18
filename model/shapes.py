"""One pigment cell following a prescribed path through 48 host cells."""
import numpy as np
import torch
from scipy import ndimage
from patch import Patch

KINDS = ["Rounded", "Spindle", "Branched"]
STEPS = 48


def smooth(x):
    v = np.clip(x, 0, 1)
    return v*v*(3-2*v)


def shape_cost(patch, kind, t, strength):
    diff = patch.xy - patch.x[0].numpy()
    angle = .1 + .32*np.sin(2*np.pi*t)
    x = diff[:,0]*np.cos(angle) + diff[:,1]*np.sin(angle)
    y = -diff[:,0]*np.sin(angle) + diff[:,1]*np.cos(angle)
    r2 = x*x+y*y
    if kind == "Rounded":
        return 7*r2
    if kind == "Spindle":
        aspect = 1+3.2*strength
        return 7*(x*x/aspect + y*y*aspect)
    cost = r2.copy()
    # Three tapered arms; split the upper arm into two gently curving branches.
    arms = [([0,0],[.44,.25],[1.08,.78]), ([0,0],[.44,.25],[1.27,.22]),
            ([0,0],[.32,-.16],[.83,-.83]), ([0,0],[-.40,-.10],[-1.02,-.32])]
    for points in arms:
        pts = np.asarray(points)*strength
        for a,b in zip(pts[:-1],pts[1:]):
            v=b-a
            u=np.clip(((x-a[0])*v[0]+(y-a[1])*v[1])/max(v@v,1.e-9),0,1)
            xx=a[0]+u*v[0]
            yy=a[1]+u*v[1]
            d2=(x-xx)**2+(y-yy)**2
            cost=np.minimum(cost, .035+.065*(xx*xx+yy*yy)+5.5*d2)
    return 7*cost


def simulate(kind, amplitude, tissue, travel):
    patch=Patch(17,168,tissue)
    start=patch.x[0].numpy().copy()
    frames=[]
    coords=[]
    errors=[]
    strengths=[]
    for k in range(-22, STEPS+1):
        t=max(0,k)/STEPS
        shift=smooth((t-.1)/.79)
        patch.x[0]=torch.tensor(start+[3.5*travel*shift, .35*travel*np.sin(np.pi*shift)])
        reach=smooth(t/.28)*(1-.80*smooth((t-.74)/.26))
        for scale in (1.,.88,.68,.40,0.):
            lab,centres,err=patch.allocate(shape_cost(patch,kind,t,scale*reach*amplitude))
            if ndimage.label(lab==0)[1]==1:
                break
        else:
            raise RuntimeError("Disconnected allocation")
        if k>=0:
            frames.append(lab.astype(np.uint8))
            coords.append(centres)
            errors.append(err)
            strengths.append(scale*reach*amplitude)
        patch.relax_hosts(centres)
    return np.array(frames),np.array(coords),np.array(errors),np.array(strengths)


