# Extensible Timer

Un temporizador extensible y configurable construido con React, TypeScript y Vite.

## Descripción

Este proyecto es un temporizador que permite a los usuarios crear y personalizar temporizadores para diferentes propósitos. La interfaz de usuario está construida con React y TypeScript, y utiliza Vite como herramienta de construcción.

## Características

*   Creación de temporizadores personalizados
*   Configuración de la duración del temporizador
*   Notificaciones al finalizar el temporizador
*   Interfaz de usuario intuitiva y fácil de usar

## Tecnologías utilizadas

*   React
*   TypeScript
*   Vite
*   ESLint

## Requisitos

*   Node.js (versión 18 o superior)
*   npm (versión 8 o superior)

## Instalación

1.  Clona el repositorio:

    ```bash
    git clone https://github.com/tu-usuario/extensible-timer.git
    ```
2.  Navega al directorio del proyecto:

    ```bash
    cd extensible-timer
    ```
3.  Instala las dependencias:

    ```bash
    npm install
    ```

## Uso

1.  Inicia el servidor de desarrollo:

    ```bash
    npm run dev
    ```
2.  Abre la aplicación en tu navegador en [http://localhost:5173](http://localhost:5173).

## Configuración

El archivo de configuración principal es `vite.config.ts`. Puedes modificar este archivo para cambiar la configuración de Vite, como el puerto del servidor de desarrollo o las opciones de compilación.

## Estructura del proyecto

```
extensible-timer/
├── .env                    # Variables de entorno
├── .gitignore              # Archivos ignorados por Git
├── biome.json              # Configuracion de Biome
├── eslint.config.js        # Configuracion de ESLint
├── index.html              # Archivo HTML principal
├── LICENSE                 # Licencia del proyecto
├── package-lock.json       # Archivo de bloqueo de dependencias
├── package.json            # Archivo de manifiesto del proyecto
├── README.md               # Este archivo
├── tsconfig.app.json       # Configuracion de TypeScript para la aplicacion
├── tsconfig.json           # Configuracion de TypeScript
├── tsconfig.node.json      # Configuracion de TypeScript para Node.js
├── vite.config.ts          # Configuracion de Vite
├── public/                 # Archivos publicos
│   └── vite.svg            # Icono de Vite
├── src/                    # Codigo fuente de la aplicacion
│   ├── App.css             # Estilos de la aplicacion
│   ├── App.tsx             # Componente principal de la aplicacion
│   ├── index.css           # Estilos globales
│   ├── main.tsx            # Punto de entrada de la aplicacion
│   ├── vite-env.d.ts       # Declaraciones de tipo para Vite
│   ├── assets/             # Recursos
│   │   └── react.svg       # Icono de React
│   ├── components/         # Componentes de React
│   │   ├── CreateTimerModal.tsx # Modal para crear temporizadores
│   │   └── FloatingTimer.tsx  # Temporizador flotante
│   ├── services/           # Servicios
│   │   └── timerService.ts  # Servicio para la gestion de temporizadores
│   └── types/              # Tipos
│       └── timer.types.ts   # Tipos para los temporizadores
```

## Contribución

Si deseas contribuir a este proyecto, por favor sigue estos pasos:

1.  Haz un fork del repositorio.
2.  Crea una rama con tu característica o corrección:

    ```bash
    git checkout -b mi-caracteristica
    ```
3.  Realiza tus cambios y commitea:

    ```bash
    git commit -m "Agrega mi característica"
    ```
4.  Sube los cambios a tu repositorio:

    ```bash
    git push origin mi-caracteristica
    ```
5.  Crea un pull request.

## Licencia

Este proyecto está licenciado bajo la [Licencia MIT](LICENSE).
