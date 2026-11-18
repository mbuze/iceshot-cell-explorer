import numpy as np
from PIL import Image
from scipy import ndimage

SIDE = 7
BG = (10, 23, 29)

def field(labels, view, size, highlight=()):
    """Render boundaries and interior depth from the allocation, without drawing invented organelles."""
    width, height = size
    left, top, span = view
    n = len(labels)
    # Interpolate each indicator only inside its own bounding box. Max weight wins at interfaces.
    xs=(left+(np.arange(width)+.5)*span/width)*n/SIDE-.5
    ys=(top-(np.arange(height)+.5)*span/width)*n/SIDE-.5
    best=np.full((height,width),-1.,dtype=np.float32)
    ids=np.full_like(best,255,dtype=np.uint8)
    bounds=ndimage.find_objects(labels.astype(int)+1)
    for i, slices in enumerate(bounds):
        if slices is None:
            continue
        xslice,yslice=slices
        xx=np.flatnonzero((xs>=xslice.start-2)&(xs<=xslice.stop+1))
        yy=np.flatnonzero((ys>=yslice.start-2)&(ys<=yslice.stop+1))
        if not len(xx) or not len(yy):
            continue
        sel=np.s_[yy[0]:yy[-1]+1,xx[0]:xx[-1]+1]
        # Cubic interpolation softens the raster stair steps at display resolution.
        crop=np.pad((labels[slices]==i).astype(np.float32),3)
        gy,gx=np.meshgrid(ys[yy]-yslice.start+3,xs[xx]-xslice.start+3,indexing='ij')
        weights=ndimage.map_coordinates(ndimage.gaussian_filter(crop,.65),[gx,gy],order=3)
        winners=(weights>best[sel]) & (weights>.02)
        ids[sel][winners]=i
        best[sel][winners]=weights[winners]
    boundary=np.zeros_like(ids,dtype=bool)
    boundary[1:] |= ids[1:]!=ids[:-1]
    boundary[:,1:] |= ids[:,1:]!=ids[:,:-1]
    dist=ndimage.distance_transform_edt(~boundary)
    shade=np.minimum(dist/(width/span*.47),1)
    rng=np.random.default_rng(712)
    tint=rng.uniform(-1,1,256)[ids]
    color=np.stack([21+10*shade+3*tint, 54+25*shade+8*tint, 62+27*shade+8*tint],axis=2)
    color+=np.exp(-dist[:,:,None]/(width/span*.020))*np.array([67,74,71])
    for i in highlight:
        color[ids==i]+=np.array([1,25,21])
    mask=ids==0
    inside=shade[mask]
    color[mask]=np.stack([238+12*inside, 146+43*inside, 65+24*inside],axis=1)
    color[mask]+=np.exp(-dist[mask,None]/1.85)*np.array([16,55,55])
    color[ids==255]=BG
    def pixel(p):
        return tuple(np.round([(p[0]-left)*width/span,(top-p[1])*width/span]).astype(int))
    return Image.fromarray(np.uint8(np.clip(color,0,255))),pixel


