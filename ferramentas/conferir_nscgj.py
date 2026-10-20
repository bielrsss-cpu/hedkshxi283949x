import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
notas=sorted({l.split('\t',1)[1].rstrip('\n') for l in open(sys.argv[3],encoding='utf-8') if l.startswith('NOTA\t')},key=len,reverse=True)
pags=[]
for p in src.split('\f'):
    L=p.split('\n')
    while L and not L[-1].strip(): L.pop()
    j=None
    for i in range(len(L)-1,-1,-1):
        if L[i].strip()=='1': j=i; break
    pags.append('\n'.join(L[:j] if j is not None else L))
fonte='\n'.join(pags)
fonte=re.sub(r'(?<=[^\s\d/.,-])\d{1,2}(?=\s|$)','',fonte)
fonte=re.sub(r'(?<=[.;:,)”"])\s?\d{1,2}(?=\s|$)','',fonte)
fonte=re.sub(r'(?<=\n)\d{1,2}(?=\n)','',fonte)
fonte=re.sub(r'(?<= )\d{1,2}(?=\n)','',fonte)
fonte=' '.join(fonte.split())
tot=falhas=0
for l in open(sys.argv[2],encoding='utf-8'):
    l=l.strip()
    if not l or l.startswith('#'): continue
    for n in notas: l=l.replace(n,'')
    l=l.replace('\\.','.').lstrip('\\')
    l=' '.join(l.split())
    tot+=1
    if l not in fonte:
        falhas+=1
        if falhas<=8: print('X',l[:160])
print(f'{tot-falhas}/{tot} linhas conferem com o PDF')
