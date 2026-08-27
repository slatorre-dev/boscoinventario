-- La rejilla de aulas de Inicio (js/home.js: AULAS.filter(a=>items.some(x=>x.aula===a.id)))
-- solo muestra aulas que tengan al menos un ítem — los 4 departamentos
-- administrativos de 0035/0036 estaban vacíos y por eso no aparecían.
-- Se les da una categoría propia y un ítem representativo cada uno.

INSERT INTO categorias (name,c,bg,i,orden,departamento) VALUES
('Material de oficina','#1e3a8a','#eff6ff','🖇️',1,'direccion'),
('Material de oficina','#6d28d9','#f5f3ff','🖇️',1,'secretaria'),
('Material de oficina','#c2410c','#fff7ed','🖇️',1,'conserjeria'),
('Material de oficina','#b91c1c','#fef2f2','🖇️',1,'administracionoficina');

INSERT INTO inventario (ref,aula,mod,item,qty,min,cat,loc,est,fecha,tipo_material,code,departamento) VALUES
('DIR','dept-direccion','','Ordenador de dirección',1,1,'Material de oficina','Despacho de dirección','Bueno','','inventariable','DIR-00001','direccion'),
('SEC','dept-secretaria','','Fotocopiadora multifunción',1,1,'Material de oficina','Secretaría','Bueno','','inventariable','SEC-00001','secretaria'),
('CON','dept-conserjeria','','Cuadro de llaves',1,1,'Material de oficina','Conserjería','Bueno','','inventariable','CON-00001','conserjeria'),
('ADM','dept-administracionoficina','','Impresora de oficina',1,1,'Material de oficina','Oficina de administración','Bueno','','inventariable','ADM-00001','administracionoficina');
