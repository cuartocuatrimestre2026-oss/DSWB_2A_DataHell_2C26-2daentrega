# TurnoFlex - Sistema Integral de Gestión de Turnos y Aforos
> **API RESTful y Consola Operativa para Espacio Sideral S.A.S.**  
> **Entrega Final (3° Parcial) - Desarrollo Web Backend (IFTS N° 29 - 2C2026 - Comisión A)**  
> **Empresa de Desarrollo: DataHell (Grupo 16)**  
> **Despliegue Cloud en Vivo:** [https://turnoflex-espacio-sideral.onrender.com/](https://turnoflex-espacio-sideral.onrender.com/)

---

## Integrantes y Responsabilidades
- **Mariela Andrea Lorenzo:** Líder Técnico y Arquitectura de Persistencia NoSQL (Configuración del servidor Express en `app.js`, conexión a MongoDB Atlas mediante Mongoose en `config/db.js` y script de inicialización idempotente `seed.js`).
- **Sonia Candela Pereira:** Desarrolladora de Dominio y Lógica POO (Modelado de esquemas Mongoose `Turno`, `Sala`, `Cliente`, `Servicio`, `Instructor`, métodos de instancia `atender()` / `cancelar()`, algoritmo de aforo con truncamiento del 15% y articulación con RF-02 de Apto Médico).
- **Johana Micaela Navarro:** Desarrolladora de Rutas, Middlewares y Seguridad (Enrutadores modulares, gestión híbrida de sesiones con `express-session` y tokens `JWT`, encriptación de claves con `bcryptjs`, auditoría con `loggerMiddleware` y sanitización con `validarIdMiddleware`).
- **Sergio Alberto Arenhardt:** Desarrollador Frontend Pug & UI (Plantillas Server-Side `main.pug`, `index.pug`, `turnos.pug`, `mis-turnos.pug`, `reservar.pug`, `login.pug`, `registro.pug`, `clientes.pug`, `error.pug` y diseño responsivo en `styles.css` con paleta institucional en variables CSS).
- **Elena Beatriz González:** Especialista en QA, Testing y Documentación (Diseño y ejecución de la suite de pruebas en Thunder Client, validación de códigos de estado HTTP 200, 201, 400, 401, 403, 404, 409, matriz de evidencias y articulación con Ingeniería de Software).

---

## Tecnologías y Arquitectura
- **Entorno de Ejecución:** Node.js (LTS v20+ / Motor V8).
- **Framework Web:** Express.js (v5.x).
- **Patrón de Arquitectura:** MVC (Modelo-Vista-Controlador) modular desacoplado.
- **Motor de Base de Datos:** MongoDB Atlas (Cloud Cluster M0 Sandbox) y MongoDB Community local.
- **Object Data Modeling (ODM):** Mongoose (v9.x) con validaciones nativas y métodos de instancia de dominio.
- **Seguridad Criptográfica:** Hash de contraseñas con `bcryptjs` (salt 10 rondas), mitigación de fuerza bruta con suspensión por 15 minutos tras 3 fallos consecutivos (`bloqueadoHasta`).
- **Autenticación Híbrida:** Sesiones de servidor (`express-session`) con cookies HttpOnly para el portal web Pug, y Tokens `JWT` (`jsonwebtoken`) con expiración de 8 horas para consumo de la API REST.
- **Preservación Histórica:** Política de baja lógica (`estado: 'activo' | 'inactivo' | 'licencia'`).
- **Motor de Vistas:** Pug (renderizado server-side diferenciado para roles `empleado` y `cliente`).

---

## Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone [https://github.com/cuartocuatrimestre2026-oss/DSWB_2A_DataHell_2C26-2daentrega.git](https://github.com/cuartocuatrimestre2026-oss/DSWB_2A_DataHell_2C26-2daentrega.git)
cd DSWB_2A_DataHell_2C26-2daentrega
```

### 2. Instalar dependencias
```bash
npm install
```
---

### 3. Configurar variables de entorno
Copiar el archivo de ejemplo para generar la configuración local:
```bash
cp .env.example .env
```

Verificar que el archivo .env contenga la cadena de conexión local y el puerto:
PORT=3000
MONGODB_URI=mongodb+srv://cuartocuatrimestre2026_db_user:qUtjKnV5tX3ldhez@cluster0.cfx59jp.mongodb.net/turnoflex?retryWrites=true&w=majority
SESSION_SECRET= [PASSWORD]
JWT_SECRET= [PASSWORD]
NODE_ENV=development

---

### 4. Inicializar y poblar la Base de Datos
```bash
npm run seed
```
---

### 5. Iniciar la aplicación
```bash
# Modo desarrollo con recarga automática
npm run dev

# Modo producción
npm start
```

El servidor quedará disponible en: http://localhost:3000

---

## Navegación de la Consola Web

El sistema presenta vistas mínimas y diferenciadas según el rol del usuario:

`1. Portal Público y Autenticación`
Inicio / Dashboard: http://localhost:3000/

Iniciar Sesión: http://localhost:3000/login (Recepción: admin@espaciosideral.com | Socio: juan.perez@mail.com)

Registro de Nuevos Socios: http://localhost:3000/registro

`2. Portal de Socios / Pacientes (Rol: cliente)`
Mis Turnos y Clases Reservadas: http://localhost:3000/mis-turnos

Reserva Autónoma de Actividades: http://localhost:3000/reservar

`3. Consola de Recepción y Personal (Rol: empleado)`
Grilla Operativa de Asistencia y Sobreturnos: http://localhost:3000/vista/turnos

Padrón Histórico de Socios y Personal: http://localhost:3000/vista/clientes

---

## Catálogo de Endpoints de la API REST (JSON)

**1. Turnos** (`/turnos`)
- `GET /turnos` - Listado general de reservas registradas en MongoDB.
- `GET /turnos/:id` - Consulta de un turno específico por ID.
- `GET /turnos/cliente/:id` - Filtro de turnos asignados a un socio.
- `GET /turnos/instructor/:id` - Grilla horaria asignada a un docente.
- `POST /turnos` - Alta de turno regular (valida aforo libre y previene superposiciones de docente o cliente).
- `POST /turnos/sobreturno` - Alta de sobreturno exclusivo de recepción (valida tope máximo del 15% y motivo obligatorio $\ge 5$ caracteres).
- `PUT /turnos/:id` - Actualización y transición de estados (reservado, atendido, cancelado) vía métodos POO.
- `DELETE /turnos/:id` - Cancelación de reserva y liberación automática de vacante.


**2. Clientes / Socios** (`/clientes`)

- `GET /clientes` - Padrón completo de usuarios en formato JSON.

- `GET /clientes/:id` - Consulta de datos de un socio por ID.

- `POST /clientes` - Alta de nuevo socio (valida unicidad de DNI y email).

- `PUT /clientes/:id` - Actualización de información de contacto o perfil.

- `DELETE /clientes/:id` - Baja lógica: archiva al socio pasando su estado a inactivo sin borrarlo de la base de datos.

**3. Salas y Aforos** (`/salas`)

- `GET /salas` - Catálogo de salones y cálculo del 15% de sobrecupo permitido.

- `GET /salas/:id` | `POST /salas` | `PUT /salas/:id` | `DELETE /salas/:id`


**4. Catálogo de Disciplinas** (`/servicios`)

- `GET /servicios` - Listado de disciplinas (Pilates Reformer, Hatha Yoga, Funcional, Terapias).

- `GET /servicios/:id` | `POST /servicios` | `PUT /servicios/:id` | `DELETE /servicios/:id`


**5. Padrón Docente** (`/instructores`)

- `GET /instructores` - Listado de profesionales y sus especialidades.

- `GET /instructores/:id` | `POST /instructores` | `PUT /instructores/:id` | `DELETE /instructores/:id`


---

## Pruebas de Integración y Evidencias (Thunder Client)

El repositorio incluye la colección exportada `turnoflex_thunder_collection.json` con los escenarios de prueba listos para importar y ejecutar en la extensión Thunder Client de VS Code:

- **Caso 1: Alta Exitosa de Turno Regular**  (`POST /turnos $\rightarrow$ 201 Created`).
- **Caso 2: Rechazo por Superposición Horaria** (`POST /turnos $\rightarrow$ 409 Conflict`).
- **Caso 3: Consulta Filtrada por Socio** (`GET /turnos/cliente/1 $\rightarrow$ 200 OK`).
- **Caso 4: Alta Exitosa de Sobreturno Autorizado** (`POST /turnos/sobreturno $\rightarrow$ 201 Created`).
- **Caso 5: Rechazo de Sobreturno por Ausencia de Motivo** (`POST /turnos/sobreturno $\rightarrow$ 400 Bad Request`).
- **Caso 6: Recurso Inexistente** (`GET /turnos/99999 $\rightarrow$ 404 Not Found`).
- **Caso 7: Transición de Estado con POO** (`PUT /turnos/1 $\rightarrow$ 200 OK - método turno.atender()`).
- **Caso 8: Cancelación y Liberación de Cupo** (`DELETE /turnos/1 $\rightarrow$ 200 OK - método turno.cancelar()`).


## Contexto Organizacional y Reglas de Negocio

Sistema modelado e implementado a partir del relevamiento de Ingeniería de Software para **Espacio Sideral S.A.S.**:

- **RN03 - No Solapamiento Horario:** Bloqueo algorítmico asincrónico ante intentos de asignar dos clases al mismo instructor o emitir dos reservas para un mismo socio en la misma franja horaria (`409 Conflict`).
- **RN04 - Aforo Físico Estricto por Sala:** Control de cupos nominales según la capacidad física instalada: Salón Pilates Reformer (10 camillas fijas), Salón Cardio/Funcional (20 personas), SUM (15 colchonetas) y Gabinetes Privados (1 persona). Bloqueo de reservas regulares una vez colmado el cupo.
- **RN05 & RN06 - Sobreturnos Parametrizados de Recepción:** Autorización exclusiva para el personal de mostrador ante salas completas, aplicando la fórmula matemática de sobrecupo con truncamiento entero (`Math.floor(capacidadNormal * 0.15)`). Se exige mandatoriamente un campo descriptivo de justificación (`motivo`, mínimo 5 caracteres) para auditoría gerencial (`400 Bad Request` si se omite).
- **RN08 - Ciclo de Vida del Turno y POO:** Gestión del estado de la reserva (`reservado`, `atendido`, `cancelado`) mediante métodos de dominio Mongoose (`turno.atender()` y `turno.cancelar()`). La cancelación libera automáticamente el cupo en la sala.
- **RN09 - Trazabilidad y Preservación Histórica (Baja Lógica):** Prohibición de eliminación física de registros de usuarios en MongoDB. La desactivación de socios o bajas se gestiona mediante el cambio de atributo a `estado: 'inactivo'` para resguardar el historial operativo. En empleados, se habilita el estado transitorio `licencia`.
- **RN10 - Seguridad y Mitigación de Fuerza Bruta:** Bloqueo temporal de acceso por 15 minutos (`bloqueadoHasta`) ante la detección de 3 intentos fallidos consecutivos de contraseña en el inicio de sesión.
- **RN11 - Mínimo Privilegio en Vistas (Pug):** Segmentación estricta de interfaces según rol: acceso de socios limitado a autogestión de turnos propios (`/mis-turnos`, `/reservar`), y acceso exclusivo de empleados a la grilla de recepción, acreditación y padrón general (`/vista/turnos`, `/vista/clientes`).