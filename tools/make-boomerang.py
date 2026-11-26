# Platshållar-boomerang (assets/boomerang.glb). Ska bytas mot en riktig modell.
# Användning: python3 make-boomerang.py  (skriver boomerang.glb i aktuell mapp)
import os
import numpy as np, trimesh
from shapely import affinity
from shapely.geometry import Point
from shapely.ops import unary_union
from scipy.spatial import Delaunay

# --- 2D-kontur: två avsmalnande, lätt böjda armar som möts i en trubbig vinkel
def arc(p0, p1, bend, n=40):
    p0,p1=np.array(p0),np.array(p1); m=(p0+p1)/2
    d=p1-p0; nrm=np.array([-d[1],d[0]])/np.linalg.norm(d)
    c=m+nrm*bend
    t=np.linspace(0,1,n)[:,None]
    return (1-t)**2*p0+2*(1-t)*t*c+t**2*p1
elbow=(0,0)
a1=arc(elbow,(-1.0,-0.42), -0.06)
a2=arc(elbow,( 0.92,-0.55), 0.06)
def tube(pts, r0, r1):
    parts=[]
    for i,p in enumerate(pts):
        r=r0+(r1-r0)*(i/(len(pts)-1))
        parts.append(Point(p).buffer(r,32))
    hull=[unary_union([parts[i],parts[i+1]]).convex_hull for i in range(len(parts)-1)]
    return unary_union(hull)
shape=unary_union([tube(a1,0.135,0.085),tube(a2,0.135,0.08)]).buffer(0.02).buffer(-0.02).simplify(0.002)
# centrera
cx,cy=shape.centroid.x,shape.centroid.y
shape=affinity.translate(shape,-cx,-cy)
# --- punkter: jämnt längs kanten + ett rutnät inuti
L=shape.exterior.length; nb=360
b=np.array([shape.exterior.interpolate(i*L/nb).coords[0] for i in range(nb)])
minx,miny,maxx,maxy=shape.bounds
g=[]
step=0.022
for x in np.arange(minx,maxx,step):
    for y in np.arange(miny,maxy,step):
        p=Point(x,y)
        if shape.contains(p) and shape.exterior.distance(p)>step*0.5: g.append((x,y))
pts=np.vstack([b,np.array(g)])
tri=Delaunay(pts)
cent=pts[tri.simplices].mean(1)
ok=np.array([shape.contains(Point(c)) for c in cent])
faces=tri.simplices[ok]
d=np.array([shape.exterior.distance(Point(p)) for p in pts])
R=0.045; T=0.02  # radie på den rundade kanten / halva tjockleken
prof=np.sqrt(np.clip(1-(1-np.clip(d/R,0,1))**2,0,1))
top_z= T*prof*1.0
bot_z=-T*prof*0.8   # plattare undersida, som en riktig boomerang
n=len(pts)
V=np.vstack([np.c_[pts,top_z],np.c_[pts,bot_z]])
# kantpunkterna har z=0 på båda sidor och svetsas ihop nedan (process=True)
F=np.vstack([faces, faces[:,::-1]+n])
uv=np.vstack([pts,pts])
# modellen ligger i XY-planet, vänd den så den ligger platt i XZ (y uppåt)
V=V[:,[0,2,1]]*np.array([1,1,-1])
uvn=(uv-uv.min(0))/(uv.max(0)-uv.min(0)).max()
# --- sjökortssymbol: en platt mörk färg (stilen sätts i koden, se tour.json boomerang.style)
mat=trimesh.visual.material.PBRMaterial(baseColorFactor=[20,32,43,255],metallicFactor=0.0,roughnessFactor=0.8,name='symbol')
mesh=trimesh.Trimesh(vertices=V,faces=F,visual=trimesh.visual.TextureVisuals(uv=uvn,material=mat),process=False)
mesh.fix_normals()
# mjuka normaler
mesh=trimesh.Trimesh(vertices=mesh.vertices,faces=mesh.faces,visual=mesh.visual,process=True,merge_tex=False)
print(mesh.is_watertight, mesh.bounds, len(mesh.faces))
scene=trimesh.Scene(); scene.add_geometry(mesh,node_name='boomerang')
open('boomerang.glb','wb').write(trimesh.exchange.gltf.export_glb(scene))
print(os.path.getsize('boomerang.glb'))
