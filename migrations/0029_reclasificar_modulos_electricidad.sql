-- Reclasifica el campo `mod` de los 1205 ítems de electricidadelectronica
-- que quedaron huérfanos tras la migración multi-departamento: usaban
-- códigos de ciclo/módulo de un esquema antiguo (gs_mantelec__1058,
-- gm_telecom__0361, gs_sea__0518...) que ya no existe en la tabla
-- `ciclos` actual (4 ciclos reales: iea/it/mele/sea, módulos M01-M15).
--
-- Mapeo hecho por Claude a partir del contenido de cada grupo (nombres de
-- ítems) y del prefijo del código viejo (gs_=Grado Superior, gm_=Grado
-- Medio), sin intervención del profesorado del departamento — revisar y
-- corregir si algún grupo no encaja bien. Los grupos genuinamente
-- genéricos (cajón de componentes electrónicos sueltos, equipo de
-- oficina/AV compartido, mobiliario) se dejan sin asignar (mod='') en
-- vez de forzarlos a un módulo concreto que no les correspondería.

-- mele__M02 (Equipos microprogramables): Arduino, robótica, kits de sensores
UPDATE inventario SET mod='mele__M02' WHERE departamento='electricidadelectronica' AND mod IN ('gs_mantelec__1052','1709');

-- mele__M04 (Equipos de radiocomunicaciones): antenas
UPDATE inventario SET mod='mele__M04' WHERE departamento='electricidadelectronica' AND mod='gs_mantelec__1053';

-- mele__M06 (Sistemas de vídeo)
UPDATE inventario SET mod='mele__M06' WHERE departamento='electricidadelectronica' AND mod='gs_mantelec__1055';

-- mele__M07 (Técnicas y procesos de montaje y mantenimiento): instrumentación (multímetros, osciloscopios, fuentes)
UPDATE inventario SET mod='mele__M07' WHERE departamento='electricidadelectronica' AND mod='gs_mantelec__1051';

-- mele__M08 (Infraestructuras y desarrollo del mantenimiento electrónico): redes, comprobadores, rack
UPDATE inventario SET mod='mele__M08' WHERE departamento='electricidadelectronica' AND mod IN ('gs_mantelec__1054','1054','gs_mantelec__1060');

-- Sin asignar: cajón genérico de componentes electrónicos sueltos + equipo
-- de oficina/AV compartido + mobiliario (mesas) — ninguno corresponde a
-- un módulo curricular concreto, forzar uno sería incorrecto.
UPDATE inventario SET mod='' WHERE departamento='electricidadelectronica' AND mod IN ('gs_mantelec__1058','1058','departamento__dpto','gm_electric__237','gm_electric__0237');

-- sea__M01 (Configuración de instalaciones domóticas y automáticas): KNX, DALI, automatismos
UPDATE inventario SET mod='sea__M01' WHERE departamento='electricidadelectronica' AND mod IN ('gs_sea__0521','gs_sea__0524');

-- sea__M02 (Configuración de instalaciones eléctricas): magnetotérmicos, contactores, relés, PLC
UPDATE inventario SET mod='sea__M02' WHERE departamento='electricidadelectronica' AND mod='gs_sea__0518';

-- sea__M04 (Técnicas y procesos en instalaciones eléctricas): material de instalación básico
UPDATE inventario SET mod='sea__M04' WHERE departamento='electricidadelectronica' AND mod IN ('gs_sea__0519','gs_sea__0520','gs_sea__0522','gs_sea__0523','gs_sea__0517');

-- iea__M01 (Automatismos industriales): finales de carrera, temporizadores, pulsadores de emergencia
UPDATE inventario SET mod='iea__M01' WHERE departamento='electricidadelectronica' AND mod='gm_electric__0235';

-- iea__M04 (Instalaciones eléctricas interiores): cableado, mecanismos, herramientas de taller
UPDATE inventario SET mod='iea__M04' WHERE departamento='electricidadelectronica' AND mod IN ('gm_electric__232','gm_electric__0232','gm_electric__233','gm_electric__0233','gm_electric__234','gm_electric__0234','gm_electric__235');

-- iea__M05 (Instalaciones de distribución): pruebas de carga/aislamiento
UPDATE inventario SET mod='iea__M05' WHERE departamento='electricidadelectronica' AND mod='gm_electric__240';

-- iea__M09 (Energías renovables): inversor solar, densímetro de batería
UPDATE inventario SET mod='iea__M09' WHERE departamento='electricidadelectronica' AND mod IN ('gm_electric__239','gm_electric__0239');

-- it__M02 (Instalaciones domóticas): KNX, tomas TV
UPDATE inventario SET mod='it__M02' WHERE departamento='electricidadelectronica' AND mod IN ('gm_telecom__237','gm_telecom__0237','gm_telecom__0238');

-- it__M03 (Electrónica aplicada): kit de sensores mal clasificado bajo telecom
UPDATE inventario SET mod='it__M03' WHERE departamento='electricidadelectronica' AND mod='gm_telecom__1709';

-- it__M04 (Equipos microinformáticos)
UPDATE inventario SET mod='it__M04' WHERE departamento='electricidadelectronica' AND mod='gm_telecom__0360';

-- it__M05 (Infraestructuras de redes de datos y sistemas de telefonía): routers, switches, APs
UPDATE inventario SET mod='it__M05' WHERE departamento='electricidadelectronica' AND mod IN ('gm_telecom__0361','gm_telecom__361','gm_telecom__0359','gm_telecom__0365');

-- it__M06 (Instalaciones de megafonía y sonorización)
UPDATE inventario SET mod='it__M06' WHERE departamento='electricidadelectronica' AND mod IN ('gm_telecom__363','gm_telecom__0363');

-- it__M07 (Circuito cerrado de televisión y seguridad electrónica): CCTV, alarmas de incendio
UPDATE inventario SET mod='it__M07' WHERE departamento='electricidadelectronica' AND mod IN ('gm_telecom__364','gm_telecom__0364');
