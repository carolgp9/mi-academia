
"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";

import { supabase } from "@/lib/supabase";

type Estado =
  | "cargando"
  | "sin-sesion"
  | "autorizado"
  | "pendiente"
  | "rechazado"
  | "bloqueado"
  | "sin-permiso"
  | "error";

type Modo =
  | "login"
  | "registro"
  | "recuperar"
  | "nueva-password";

const azul = "#142b40";
const dorado = "#b4955d";
const gris = "#718096";

const campo = {
  width: "100%",
  padding: "13px 15px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  fontSize: 15,
  color: azul,
  background: "#ffffff",
  boxSizing: "border-box",
} as const;

const boton = {
  width: "100%",
  padding: "13px 18px",
  background: azul,
  color: "#ffffff",
  border: "1px solid " + dorado,
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
} as const;

const secundario = {
  ...boton,
  background: "#ffffff",
  color: azul,
};

function traducirError(mensaje: string) {
  const texto = mensaje.toLowerCase();

  if (texto.includes("invalid login credentials")) {
    return "El correo electrónico o la contraseña no son correctos.";
  }

  if (texto.includes("email not confirmed")) {
    return "Debes confirmar tu correo electrónico.";
  }

  if (
    texto.includes("rate limit") ||
    texto.includes("too many requests")
  ) {
    return "Demasiados intentos. Espera unos minutos.";
  }

  if (texto.includes("already registered")) {
    return "Si ya tienes una cuenta, inicia sesión con ella.";
  }

  return mensaje;
}

function mensajeError(e: unknown) {
  return traducirError(
    e instanceof Error
      ? e.message
      : "No se ha podido completar la operación."
  );
}

export default function AccesoAcademia({
  children,
}: {
  children: ReactNode;
}) {
  const [estado, setEstado] =
    useState<Estado>("cargando");

  const [modo, setModo] =
    useState<Modo>("login");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [emailUsuario, setEmailUsuario] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const recuperando = useRef(false);
  const version = useRef(0);
  const usuarioActual = useRef("");

  const comprobarAcceso = useCallback(async () => {
    if (recuperando.current) return;

    const intento = ++version.current;

    try {
      const {
        data: { session },
        error: errorSesion,
      } = await supabase.auth.getSession();

      if (intento !== version.current) return;

      if (errorSesion) throw errorSesion;

      if (!session) {
        usuarioActual.current = "";
        setEstado("sin-sesion");
        setEsAdmin(false);
        setUsuarioId("");
        setEmailUsuario("");
        setNombreUsuario("");
        return;
      }

      if (usuarioActual.current !== session.user.id) {
        setEstado("cargando");
        setEsAdmin(false);
      }

      const {
        data: { user },
        error: errorUsuario,
      } = await supabase.auth.getUser();

      if (intento !== version.current) return;

      if (errorUsuario || !user) {
        throw new Error("No se pudo verificar la sesión.");
      }

      setEmailUsuario(user.email || "");

      const nombre =
        user.user_metadata?.nombre ||
        user.user_metadata?.full_name ||
        "";

      setNombreUsuario(
        typeof nombre === "string" ? nombre : ""
      );

      const {
        data: permisos,
        error: errorPermisos,
      } = await supabase
        .from("access_permissions")
        .select("status,is_admin,access_academia")
        .eq("user_id", user.id)
        .maybeSingle();

      if (intento !== version.current) return;

      if (errorPermisos) throw errorPermisos;

      setEsAdmin(false);
      setError("");

      if (!permisos || permisos.status === "pending") {
        setEstado("pendiente");
        return;
      }

      if (permisos.status === "rejected") {
        setEstado("rechazado");
        return;
      }

      if (permisos.status === "blocked") {
        setEstado("bloqueado");
        return;
      }

      if (
        permisos.status !== "approved" ||
        !permisos.access_academia
      ) {
        setEstado("sin-permiso");
        return;
      }

      const {
        data: autorizado,
        error: errorAcceso,
      } = await supabase.rpc("tiene_acceso", {
        plataforma: "academia",
      });

      if (intento !== version.current) return;

      if (errorAcceso) throw errorAcceso;

      if (autorizado !== true) {
        setEstado("sin-permiso");
        return;
      }

      usuarioActual.current = user.id;
      setUsuarioId(user.id);
      setEsAdmin(permisos.is_admin === true);
      setEstado("autorizado");
    } catch {
      if (intento !== version.current) return;

      setEsAdmin(false);
      setEstado("error");
      setError(
        "No se ha podido comprobar tu autorización. Inténtalo de nuevo."
      );
    }
  }, []);

  useEffect(() => {
    let activo = true;

    let temporizador:
      | ReturnType<typeof setTimeout>
      | undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (evento, session) => {
        if (!activo) return;

        if (evento === "PASSWORD_RECOVERY") {
          recuperando.current = true;
          version.current++;

          clearTimeout(temporizador);

          setModo("nueva-password");
          setEstado("sin-sesion");
          setPassword("");
          setConfirmarPassword("");
          setError("");
          setMensaje("");

          return;
        }

        if (evento === "SIGNED_OUT") {
          recuperando.current = false;
          usuarioActual.current = "";
          version.current++;

          clearTimeout(temporizador);

          setEstado("sin-sesion");
          setModo("login");
          setEsAdmin(false);
          setUsuarioId("");
          setEmailUsuario("");
          setNombreUsuario("");
          setPassword("");
          setConfirmarPassword("");

          return;
        }

        if (
          evento === "INITIAL_SESSION" ||
          evento === "SIGNED_IN" ||
          evento === "TOKEN_REFRESHED" ||
          evento === "USER_UPDATED"
        ) {
          if (
            session &&
            session.user.id !== usuarioActual.current &&
            !recuperando.current
          ) {
            version.current++;
            setEstado("cargando");
            setEsAdmin(false);
          }

          clearTimeout(temporizador);

          temporizador = setTimeout(() => {
            if (activo) void comprobarAcceso();
          }, 0);
        }
      }
    );

    return () => {
      activo = false;
      version.current++;
      clearTimeout(temporizador);
      subscription.unsubscribe();
    };
  }, [comprobarAcceso]);

  useEffect(() => {
    if (
      estado === "sin-sesion" ||
      estado === "cargando" ||
      modo === "nueva-password"
    ) {
      return;
    }

    const intervalo = window.setInterval(() => {
      void comprobarAcceso();
    }, 30000);

    function alVolver() {
      if (document.visibilityState === "visible") {
        void comprobarAcceso();
      }
    }

    document.addEventListener(
      "visibilitychange",
      alVolver
    );

    return () => {
      window.clearInterval(intervalo);

      document.removeEventListener(
        "visibilitychange",
        alVolver
      );
    };
  }, [estado, modo, comprobarAcceso]);

  function cambiarModo(nuevoModo: Modo) {
    setModo(nuevoModo);
    setError("");
    setMensaje("");
    setPassword("");
    setConfirmarPassword("");
    setMostrarPassword(false);
  }

  async function iniciarSesion(e: FormEvent) {
    e.preventDefault();

    if (ocupado) return;

    setOcupado(true);
    setError("");
    setMensaje("");

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) throw error;

      setPassword("");
      await comprobarAcceso();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function registrarse(e: FormEvent) {
    e.preventDefault();

    if (ocupado) return;

    setError("");
    setMensaje("");

    if (nombre.trim().length < 2) {
      setError("Introduce tu nombre completo.");
      return;
    }

    if (password.length < 8) {
      setError(
        "La contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (!acepta) {
      setError("Debes aceptar las condiciones de acceso.");
      return;
    }

    setOcupado(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nombre: nombre.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        });

      if (error) throw error;

      setPassword("");
      setConfirmarPassword("");
      setAcepta(false);

      if (data.session) {
        await comprobarAcceso();
      } else {
        setModo("login");
        setMensaje(
          "Si el registro se ha completado, recibirás un correo de confirmación. Después deberás esperar la autorización de la administradora."
        );
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function recuperarPassword(e: FormEvent) {
    e.preventDefault();

    if (ocupado) return;

    setOcupado(true);
    setError("");
    setMensaje("");

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin,
          }
        );

      if (error) throw error;

      setMensaje(
        "Si existe una cuenta asociada a este correo, recibirás un enlace para restablecer tu contraseña."
      );
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function guardarPassword(e: FormEvent) {
    e.preventDefault();

    if (ocupado) return;

    setError("");
    setMensaje("");

    if (!recuperando.current) {
      setError("El enlace de recuperación no es válido.");
      return;
    }

    if (password.length < 8) {
      setError(
        "La contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setOcupado(true);

    try {
      const { error } =
        await supabase.auth.updateUser({ password });

      if (error) throw error;

      const { error: errorSalida } =
        await supabase.auth.signOut();

      if (errorSalida) throw errorSalida;

      recuperando.current = false;
      usuarioActual.current = "";

      setPassword("");
      setConfirmarPassword("");
      setModo("login");
      setEstado("sin-sesion");

      setMensaje(
        "Tu contraseña se ha actualizado correctamente. Ya puedes iniciar sesión."
      );
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function cerrarSesion() {
    setOcupado(true);
    setError("");

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) throw error;

      recuperando.current = false;
      usuarioActual.current = "";
      version.current++;

      setEstado("sin-sesion");
      setModo("login");
      setEsAdmin(false);
      setUsuarioId("");
      setEmailUsuario("");
      setNombreUsuario("");
      setPassword("");
      setConfirmarPassword("");
      setMensaje("");
    } catch {
      setError(
        "No se pudo cerrar la sesión. Inténtalo de nuevo."
      );
    } finally {
      setOcupado(false);
    }
  }

  if (
    estado === "autorizado" &&
    modo !== "nueva-password" &&
    usuarioId
  ) {
    return (
      <>
        <div
          style={{
            background: azul,
            color: "#ffffff",
            borderBottom: "1px solid " + dorado,
            padding: "12px 20px",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ overflowWrap: "anywhere" }}>
              <strong>
                {esAdmin ? "🛡️ " : "👤 "}
                {nombreUsuario || emailUsuario}
              </strong>

              <div
                style={{
                  color: "#e5c997",
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {esAdmin
                  ? "Administradora"
                  : "Usuario autorizado"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {esAdmin && (
                <a
                  href="https://melilla-calle-a-calle-five.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#e5c997",
                    color: azul,
                    borderRadius: 8,
                    padding: "9px 13px",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Gestionar usuarios
                </a>
              )}

              <button
                onClick={cerrarSesion}
                disabled={ocupado}
                style={{
                  ...boton,
                  width: "auto",
                  padding: "9px 13px",
                  fontSize: 12,
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                color: "#ffb5b5",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div key={usuarioId}>{children}</div>
      </>
    );
  }

  const titulos = {
    login: "Bienvenida",
    registro: "Solicitar acceso",
    recuperar: "Recuperar contraseña",
    "nueva-password": "Nueva contraseña",
  };

  const descripciones = {
    login: "Accede a tu espacio personal de estudio.",
    registro:
      "Crea tu cuenta y espera la autorización de la administradora.",
    recuperar:
      "Te enviaremos un enlace a tu correo electrónico.",
    "nueva-password":
      "Elige una nueva contraseña para tu cuenta.",
  };

  const restricciones = {
    pendiente: {
      icono: "⏳",
      titulo: "Solicitud pendiente",
      descripcion:
        "Tu cuenta está registrada. Debes esperar a que la administradora autorice tu acceso.",
    },
    rechazado: {
      icono: "🚫",
      titulo: "Solicitud no autorizada",
      descripcion:
        "Tu solicitud no ha sido aceptada. Contacta con la administradora.",
    },
    bloqueado: {
      icono: "🔒",
      titulo: "Cuenta bloqueada",
      descripcion: "Tu acceso ha sido suspendido.",
    },
    "sin-permiso": {
      icono: "🔐",
      titulo: "Acceso restringido",
      descripcion:
        "Tu cuenta no tiene permiso para acceder a El rincón de Lucía.",
    },
  };

  const restriccion =
    estado === "pendiente" ||
    estado === "rechazado" ||
    estado === "bloqueado" ||
    estado === "sin-permiso"
      ? restricciones[estado]
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg,#142b40,#203e58,#142b40)",
        padding: "35px 18px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <header
          style={{
            textAlign: "center",
            color: "#ffffff",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 13,
              letterSpacing: 3,
              color: "#e5c997",
            }}
          >
            TU ESPACIO DE ESTUDIO
          </div>

          <div style={{ fontSize: 48, marginTop: 18 }}>
            📚
          </div>

          <h1
            style={{
              color: "#e5c997",
              fontSize: 34,
              marginBottom: 10,
            }}
          >
            El rincón de Lucía
          </h1>

          <p style={{ color: "#ffffff", fontSize: 15 }}>
            Un sueño, una meta, una plaza.
          </p>
        </header>

        <section
          style={{
            background: "#ffffff",
            color: azul,
            border: "1px solid " + dorado,
            borderRadius: 20,
            padding: "28px 24px",
            boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
          }}
        >
          {estado === "cargando" ? (
            <div
              style={{
                textAlign: "center",
                padding: "25px 0",
              }}
            >
              <div style={{ fontSize: 40 }}>🔐</div>

              <h2>Comprobando acceso</h2>

              <p style={{ color: gris }}>
                Verificando tu sesión y tus permisos...
              </p>
            </div>
          ) : estado === "error" &&
            modo !== "nueva-password" ? (
            <div style={{ textAlign: "center" }}>
              <h2>Error de conexión</h2>

              <p style={{ color: "#b91c1c" }}>
                {error}
              </p>

              <button
                style={boton}
                onClick={() => void comprobarAcceso()}
              >
                Volver a intentar
              </button>

              <button
                style={{ ...secundario, marginTop: 12 }}
                onClick={cerrarSesion}
                disabled={ocupado}
              >
                Cerrar sesión
              </button>
            </div>
          ) : restriccion &&
            modo !== "nueva-password" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 45 }}>
                {restriccion.icono}
              </div>

              <h2>{restriccion.titulo}</h2>

              <p style={{ color: gris, lineHeight: 1.7 }}>
                {restriccion.descripcion}
              </p>

              <div
                style={{
                  background: "#fcf7ed",
                  border: "1px solid " + dorado,
                  borderRadius: 12,
                  padding: 15,
                  margin: "20px 0",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>
                  {nombreUsuario || "Usuario"}
                </strong>

                <p>{emailUsuario}</p>
              </div>

              {estado === "pendiente" && (
                <p style={{ fontSize: 12, color: gris }}>
                  Comprobaremos automáticamente tu
                  autorización cada 30 segundos.
                </p>
              )}

              <button
                style={boton}
                onClick={() => void comprobarAcceso()}
              >
                Comprobar autorización
              </button>

              <button
                style={{ ...secundario, marginTop: 12 }}
                onClick={cerrarSesion}
                disabled={ocupado}
              >
                Cerrar sesión
              </button>

              {error && (
                <p role="alert" style={{ color: "#b91c1c" }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 25,
                }}
              >
                <div style={{ fontSize: 35 }}>
                  {modo === "registro"
                    ? "👤"
                    : modo === "recuperar" ||
                      modo === "nueva-password"
                    ? "🔑"
                    : "🔐"}
                </div>

                <h2>{titulos[modo]}</h2>

                <p
                  style={{
                    color: gris,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {descripciones[modo]}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    background: "#fff1f1",
                    color: "#b91c1c",
                    border: "1px solid #e8b5b5",
                    borderRadius: 10,
                    padding: 13,
                    fontSize: 13,
                    marginBottom: 18,
                  }}
                >
                  {error}
                </div>
              )}

              {mensaje && (
                <div
                  role="status"
                  style={{
                    background: "#e5f5eb",
                    color: "#166534",
                    border: "1px solid #a9d8b7",
                    borderRadius: 10,
                    padding: 13,
                    fontSize: 13,
                    marginBottom: 18,
                    lineHeight: 1.6,
                  }}
                >
                  {mensaje}
                </div>
              )}

              <form
                onSubmit={
                  modo === "registro"
                    ? registrarse
                    : modo === "recuperar"
                    ? recuperarPassword
                    : modo === "nueva-password"
                    ? guardarPassword
                    : iniciarSesion
                }
                style={{ display: "grid", gap: 17 }}
              >
                {modo === "registro" && (
                  <label>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Nombre completo
                    </div>

                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre y apellidos"
                      autoComplete="name"
                      required
                      maxLength={100}
                      style={campo}
                    />
                  </label>
                )}

                {modo !== "nueva-password" && (
                  <label>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Correo electrónico
                    </div>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Introduce tu correo"
                      autoComplete="email"
                      required
                      style={campo}
                    />
                  </label>
                )}

                {modo !== "recuperar" && (
                  <label>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      {modo === "nueva-password"
                        ? "Nueva contraseña"
                        : "Contraseña"}
                    </div>

                    <div style={{ position: "relative" }}>
                      <input
                        type={mostrarPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          modo === "login"
                            ? "Introduce tu contraseña"
                            : "Mínimo 8 caracteres"
                        }
                        autoComplete={
                          modo === "login"
                            ? "current-password"
                            : "new-password"
                        }
                        required
                        style={{ ...campo, paddingRight: 75 }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setMostrarPassword(!mostrarPassword)
                        }
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          color: "#98753e",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: 0,
                        }}
                      >
                        {mostrarPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </label>
                )}

                {(modo === "registro" ||
                  modo === "nueva-password") && (
                  <label>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Confirmar contraseña
                    </div>

                    <input
                      type={mostrarPassword ? "text" : "password"}
                      value={confirmarPassword}
                      onChange={(e) =>
                        setConfirmarPassword(e.target.value)
                      }
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      required
                      style={campo}
                    />
                  </label>
                )}

                {modo === "registro" && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 12,
                      lineHeight: 1.6,
                      background: "#fcf7ed",
                      padding: 12,
                      borderRadius: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={acepta}
                      onChange={(e) => setAcepta(e.target.checked)}
                      required
                      style={{
                        accentColor: dorado,
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                      }}
                    />

                    Entiendo que esta plataforma es privada
                    y que mi acceso deberá ser autorizado
                    por la administradora.
                  </label>
                )}

                <button
                  type="submit"
                  disabled={ocupado}
                  style={{
                    ...boton,
                    opacity: ocupado ? 0.6 : 1,
                  }}
                >
                  {ocupado
                    ? "Procesando..."
                    : modo === "registro"
                    ? "Solicitar acceso"
                    : modo === "recuperar"
                    ? "Enviar enlace"
                    : modo === "nueva-password"
                    ? "Guardar contraseña"
                    : "Iniciar sesión"}
                </button>
              </form>

              {modo === "login" ? (
                <>
                  <button
                    type="button"
                    onClick={() => cambiarModo("recuperar")}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "#98753e",
                      cursor: "pointer",
                      width: "100%",
                      marginTop: 18,
                      fontSize: 13,
                    }}
                  >
                    ¿Has olvidado tu contraseña?
                  </button>

                  <hr
                    style={{
                      border: 0,
                      borderTop: "1px solid #e5e7eb",
                      margin: "24px 0",
                    }}
                  />

                  <p
                    style={{
                      textAlign: "center",
                      color: gris,
                      fontSize: 13,
                    }}
                  >
                    ¿Todavía no tienes cuenta?
                  </p>

                  <button
                    type="button"
                    onClick={() => cambiarModo("registro")}
                    style={secundario}
                  >
                    Solicitar acceso
                  </button>

                  <div
                    style={{
                      background: "#fcf7ed",
                      borderRadius: 10,
                      padding: 13,
                      marginTop: 18,
                      fontSize: 12,
                      lineHeight: 1.6,
                      textAlign: "center",
                    }}
                  >
                    Si ya tienes una cuenta en
                    Melilla, calle a calle,
                    puedes utilizar el mismo
                    correo y contraseña.
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (modo === "nueva-password") {
                      void cerrarSesion();
                    } else {
                      cambiarModo("login");
                    }
                  }}
                  style={{ ...secundario, marginTop: 20 }}
                >
                  ← Volver al inicio de sesión
                </button>
              )}

              <p
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  color: gris,
                  marginTop: 25,
                }}
              >
                🔒 Plataforma privada.
                Acceso sujeto a autorización.
              </p>
            </>
          )}
        </section>

        <footer
          style={{
            color: "#e5c997",
            textAlign: "center",
            marginTop: 28,
            background: "transparent",
          }}
        >
          <div style={{ fontSize: 23 }}>♥</div>

          <p style={{ fontSize: 13 }}>
            Creado con amor para Lucía.
          </p>

          <p
            style={{
              fontFamily: "cursive",
              fontSize: 24,
              color: "#c6a46c",
            }}
          >
            Carol Glez.
          </p>

          <small style={{ fontSize: 11, opacity: 0.8 }}>
            El rincón de Lucía · 2026
          </small>
        </footer>
      </div>
    </main>
  );
}

