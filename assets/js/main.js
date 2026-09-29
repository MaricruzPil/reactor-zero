import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";

/* ===============================
   ESCENA
================================ */

const scene = new THREE.Scene();
const loadingManager = new THREE.LoadingManager();
const loader = new GLTFLoader(loadingManager);
const fbxLoader = new FBXLoader(loadingManager);

const LOAD_RETRY_LIMIT = 3;
const LOAD_RETRY_DELAY_MS = 450;
const resourceLoadCache = new Map();

function waitForRetryDelay(attempt) {
    return new Promise((resolve) => {
        setTimeout(
            resolve,
            LOAD_RETRY_DELAY_MS * attempt
        );
    });
}

function loadWithRetry(cacheKey, startLoad) {

    if (resourceLoadCache.has(cacheKey)) {
        return resourceLoadCache.get(cacheKey);
    }

    const loadPromise = (async () => {

        let lastError = null;

        for (let attempt = 1; attempt <= LOAD_RETRY_LIMIT; attempt++) {

            try {
                return await startLoad();
            } catch (error) {
                lastError = error;

                if (attempt < LOAD_RETRY_LIMIT) {
                    console.warn(
                        `Reintentando carga (${attempt + 1}/${LOAD_RETRY_LIMIT}): ${cacheKey}`,
                        error
                    );

                    await waitForRetryDelay(attempt);
                }
            }
        }

        console.error(
            `Carga fallida definitivamente: ${cacheKey}`,
            lastError
        );

        resourceLoadCache.delete(cacheKey);
        throw lastError;
    })();

    resourceLoadCache.set(cacheKey, loadPromise);
    return loadPromise;
}

function loadGltfResource(path) {
    return loadWithRetry(
        path,
        () => new Promise((resolve, reject) => {
            loader.load(
                path,
                resolve,
                undefined,
                reject
            );
        })
    );
}

function loadAudioResource(audio, cacheKey) {
    return loadWithRetry(
        cacheKey,
        () => new Promise((resolve, reject) => {

            if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                resolve(audio);
                return;
            }

            let fallbackTimeout = null;
            let settled = false;

            const cleanup = () => {
                if (fallbackTimeout !== null) {
                    clearTimeout(fallbackTimeout);
                    fallbackTimeout = null;
                }

                audio.removeEventListener("loadeddata", onReady);
                audio.removeEventListener("canplay", onReady);
                audio.removeEventListener("canplaythrough", onReady);
                audio.removeEventListener("error", onError);
            };

            const onReady = () => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                resolve(audio);
            };

            const onError = () => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                reject(audio.error || new Error(cacheKey));
            };

            fallbackTimeout =
                setTimeout(
                    onReady,
                    2500
                );

            audio.addEventListener(
                "loadeddata",
                onReady,
                { once: true }
            );

            audio.addEventListener(
                "canplay",
                onReady,
                { once: true }
            );

            audio.addEventListener(
                "canplaythrough",
                onReady,
                { once: true }
            );

            audio.addEventListener(
                "error",
                onError,
                { once: true }
            );

            audio.preload = "auto";
            audio.load();
        })
    );
}


const clock = new THREE.Clock();
let playerBody = null;
let playerCollider = null;
let characterController = null;
let r0Mixer = null;
let r0 = null;
let doorFrameModel = null;
let wallAstraOriginalModel = null;
let frontLeftWallGroupModel = null;
let frontRightWallGroupModel = null;
let frontDoorFillersGroup = null;
let frontEntranceBarrierCreated = false;
let currentR0Action = null;
let isR0Attacking = false;
let pendingAttackPulseTimeout = null;
const generators = [];
let activatedGenerators = 0;
let levelCompleted = false;
const energyPulses = [];
const pulseImpactEffects = [];
let energyAnomaly = null;
let energyAnomalyHealth = 3;
let currentLevel = 1;
let spindModel = null;
let controlPanelModel = null;
let level3Reactor = null;
let level3ControlPanel = null;
let level3Machinery = null;
let reactorSupportModel = null;
let reactorModel = null;
const unstableCores = [];
let unstableCoreModel = null;
let cableModel = null;
let computerModel = null;
let ventModel = null;
const level1Decorations = [];
let level1IndustrialBackdrop = null;
let level1PreviousFog = null;
let level1FogOverridden = false;
let level1PreviousIndustrialBackgroundVisible = true;
const level2Decorations = [];
let labModel = null;
let destroyedUnstableCores = 0;
const reactorSupports = [];
let destroyedReactorSupports = 0;
const LEVEL3_ESCAPE_TIME = 30;
let level3EscapeActive = false;
let level3EscapeTimeRemaining = LEVEL3_ESCAPE_TIME;
let level3ExitZone = null;
let level3ExitModelOriginal = null;
let objectiveMarker = null;
let objectiveMarkerTarget = null;
let objectiveMarkerLabel = "";
let missionNotificationTimeout = null;
let r0Energy = 100;
let score = 0;
let level2RechargeCount = 0;
let lastAnomalyDamageTime = 0;
let gameOver = false;
const LEVEL_TIME_LIMIT = 70;
const ENERGY_COST_PER_CORE_PULSE = 10;
const PULSE_POWER_MULTIPLIERS = {
    normal: 1,
    powerful: 1.6
};
let pulsePhysicsPowerMultiplier =
    PULSE_POWER_MULTIPLIERS.normal;
let timerAccumulator = 0;
let levelTimeRemaining = LEVEL_TIME_LIMIT;
let levelTimerRunning = false;
let gameplayActive = false;
let isPaused = false;
let isActionLocked = false;
let actionLockReleaseTimeout = null;
let actionLockAudio = null;
let level2RechargeStation = null;
const interactionPrompt =
    document.getElementById(
        "interaction-prompt"
    );
const systemNotification =
    document.getElementById(
        "system-notification"
    );

const notificationMessage =
    document.getElementById(
        "notification-message"
    );
const currentObjectiveDisplay =
    document.getElementById(
        "current-objective"
    );
const objectiveHintDisplay =
    document.getElementById(
        "objective-hint"
    );
const interactionPromptKey =
    interactionPrompt.querySelector(
        ".interaction-key"
    );
const interactionPromptLabel =
    interactionPrompt.querySelector(
        ".interaction-text small"
    );
const interactionPromptMessage =
    interactionPrompt.querySelector(
        ".interaction-text strong"
    );
// Posiciones de los 3 generadores del Nivel 1
const generatorPositions = [
    { x: -8, y: 0.70, z: -5 },
    { x: 8, y: 0.73, z: -5 },
    { x: 0, y: 0.73, z: 5 }
];
const r0Actions = {};
const r0Keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    f: false
};
const r0MoveDirection = new THREE.Vector3();
const r0WalkSpeed = 3;
const r0RunSpeed = 6;
const cameraFollowOffset =
    new THREE.Vector3(0, 4, 7);
const cameraFollowPosition =
    new THREE.Vector3();
const cameraLookTarget =
    new THREE.Vector3();
const cameraPreviousTarget =
    new THREE.Vector3();
const cameraTargetDelta =
    new THREE.Vector3();
const cameraRearForward =
    new THREE.Vector3();
const cameraRearDesiredPosition =
    new THREE.Vector3();
const cameraManualGraceTime = 900;
const cameraRearAlignStrength = 0.015;
const cameraRearHeightOffset = 1.7;
const cameraRearDistance = 7;
let lastManualCameraInputTime = 0;
// Detección de obstáculos entre R-0 y la cámara
const cameraRaycaster = new THREE.Raycaster();

const cameraRayDirection =
    new THREE.Vector3();
const cameraOcclusionFocus =
    new THREE.Vector3();
const cameraOcclusionDirection =
    new THREE.Vector3();
const cameraOcclusionSafePosition =
    new THREE.Vector3();

const cameraObstacles = [];
const cameraObstacleMeshes = [];
const cameraCollisionMargin = 0.35;
const cameraOcclusionMargin = 0.45;

function registerCameraObstacle(object) {

    if (!cameraObstacles.includes(object)) {
        cameraObstacles.push(object);
    }

    object.traverse((child) => {

        if (
            child.isMesh &&
            child.geometry &&
            !child.isSprite &&
            !child.userData.ignoreCameraOcclusion &&
            !cameraObstacleMeshes.includes(child)
        ) {
            cameraObstacleMeshes.push(child);
        }
    });
}

function createCameraBoundaryObstacles() {

    const boundaryMaterial =
        new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

    const boundaries = [
        {
            position: [0, 3, -11.6],
            size: [31, 6, 0.4]
        },
        {
            position: [0, 3, 11.6],
            size: [31, 6, 0.4]
        },
        {
            position: [-15.6, 3, 0],
            size: [0.4, 6, 23]
        },
        {
            position: [15.6, 3, 0],
            size: [0.4, 6, 23]
        }
    ];

    boundaries.forEach((boundary) => {

        const obstacle =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    boundary.size[0],
                    boundary.size[1],
                    boundary.size[2]
                ),
                boundaryMaterial
            );

        obstacle.position.set(
            boundary.position[0],
            boundary.position[1],
            boundary.position[2]
        );

        obstacle.userData.cameraBoundary = true;

        scene.add(obstacle);
        registerCameraObstacle(obstacle);
    });
}

createCameraBoundaryObstacles();

function removeCameraObstacle(object) {

    const index =
        cameraObstacles.indexOf(object);

    if (index !== -1) {
        cameraObstacles.splice(index, 1);
    }

    object.traverse((child) => {

        const meshIndex =
            cameraObstacleMeshes.indexOf(child);

        if (meshIndex !== -1) {
            cameraObstacleMeshes.splice(meshIndex, 1);
        }
    });
}

await RAPIER.init();

const gravity = {
    x: 0.0,
    y: -9.81,
    z: 0.0
};

const physicsWorld = new RAPIER.World(gravity);

console.log(
    "Rapier inicializado correctamente"
);

const floorBodyDesc =
    RAPIER.RigidBodyDesc
        .fixed()
        .setTranslation(
            0,
            -0.05,
            0
        );

const floorBody =
    physicsWorld.createRigidBody(
        floorBodyDesc
    );

const floorColliderDesc =
    RAPIER.ColliderDesc.cuboid(
        14,
        0.1,
        10
    );

physicsWorld.createCollider(
    floorColliderDesc,
    floorBody
);

console.log(
    "Collider del piso creado correctamente"
);

const backWallBodyDesc =
    RAPIER.RigidBodyDesc
        .fixed()
        .setTranslation(
            0,
            1.5,
            -10
        );

const backWallBody =
    physicsWorld.createRigidBody(
        backWallBodyDesc
    );

const backWallColliderDesc =
    RAPIER.ColliderDesc.cuboid(
        14,
        1.5,
        0.6
    );

physicsWorld.createCollider(
    backWallColliderDesc,
    backWallBody
);

console.log(
    "Collider pared trasera creado correctamente"
);

// Ambiente exterior industrial
const environmentColor = 0x000000;

scene.background = new THREE.Color(
    environmentColor
);

// Niebla atmosférica
scene.fog = new THREE.FogExp2(
    environmentColor,
    0.030
);
/* ===============================
   TEXTURA DEL FONDO INDUSTRIAL
================================ */

const backgroundTextureLoader =
    new THREE.TextureLoader();

const industrialBackgroundTexture =
    backgroundTextureLoader.load(
        "./assets/textures/industrial_background.png",
        () => {
            console.log(
                "Textura industrial cargada correctamente"
            );
        },
        undefined,
        (error) => {
            console.error(
                "Error cargando textura industrial:",
                error
            );
        }
    );

industrialBackgroundTexture.colorSpace =
    THREE.SRGBColorSpace;



/* ===============================
   CÁMARA
================================ */

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(8, 6, 10);


/* ===============================
   RENDERER
================================ */

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;

document
    .getElementById("game-container")
    .appendChild(renderer.domElement);

/* ===============================
   AUDIO
================================ */

const audioSystem = (() => {

    const musicVolume = 0.25;
    const sfxVolumes = {
        energyPulse: 0.45,
        energyImpact: 0.40,
        energyRecharge: 0.50,
        evacuationAlarm: 0.45,
        generatorActivate: 0.55,
        objectiveDestroyed: 0.60,
        victory: 0.60,
        lostEnergy: 0.55,
        gameOver: 0.65,
        button: 0.45
    };

    const musicTracks = {
        1: new Audio("./assets/sounds/music/level1_factory.mp3"),
        2: new Audio("./assets/sounds/music/level2_lab.mp3"),
        3: new Audio("./assets/sounds/music/level3_reactor.mp3")
    };

    const sfx = {
        energyPulse: new Audio("./assets/sounds/sfx/energy_pulse.mp3"),
        energyImpact: new Audio("./assets/sounds/sfx/energy_impact.mp3"),
        energyRecharge: new Audio("./assets/sounds/sfx/energy_recharge.mp3"),
        evacuationAlarm: new Audio("./assets/sounds/sfx/evacuation_alarm.mp3"),
        generatorActivate: new Audio("./assets/sounds/sfx/generator_activate.mp3"),
        objectiveDestroyed: new Audio("./assets/sounds/sfx/objective_destroyed.mp3"),
        victory: new Audio("./assets/sounds/sfx/victory.mp3"),
        lostEnergy: new Audio("./assets/sounds/sfx/lost-energy.mp3"),
        gameOver: new Audio("./assets/sounds/sfx/game-over.mp3"),
        button: new Audio("./assets/sounds/sfx/buttom.mp3")
    };

    let unlocked = false;
    let pendingLevelMusic = null;
    let currentMusic = null;
    let alarmPlaying = false;
    let victoryPlayed = false;
    let gameOverPlayed = false;
    let musicPausedByGame = false;
    let alarmPausedByGame = false;
    const activeSfxInstances = {};

    Object
        .values(musicTracks)
        .forEach((track, index) => {
            track.loop = true;
            track.volume = musicVolume;
            track.preload = index === 0 ? "auto" : "none";
        });

    Object
        .entries(sfx)
        .forEach(([key, sound]) => {
            sound.volume = sfxVolumes[key];
            sound.preload = "auto";
        });

    sfx.evacuationAlarm.loop = true;

    const safePlay = (audio) => {
        const playPromise = audio.play();

        if (playPromise && playPromise.catch) {
            playPromise.catch(() => { });
        }

        return playPromise;
    };

    const stopAudio = (audio) => {
        audio.pause();
        audio.currentTime = 0;
    };

    const stopMusic = () => {
        if (currentMusic) {
            stopAudio(currentMusic);
            currentMusic = null;
        }
    };

    const playLevelMusic = (level) => {
        pendingLevelMusic = level;

        if (!unlocked) {
            return;
        }

        const nextMusic =
            musicTracks[level];

        if (!nextMusic) {
            return;
        }

        if (currentMusic === nextMusic) {
            return;
        }

        stopMusic();
        currentMusic = nextMusic;
        currentMusic.currentTime = 0;
        safePlay(currentMusic);
    };

    const trackSfxInstance = (key, instance) => {

        if (!activeSfxInstances[key]) {
            activeSfxInstances[key] = new Set();
        }

        activeSfxInstances[key].add(instance);

        instance.addEventListener(
            "ended",
            () => {
                activeSfxInstances[key].delete(instance);
            },
            { once: true }
        );
    };

    const playSfx = (key) => {
        const source =
            sfx[key];

        if (!source || !unlocked) {
            return null;
        }

        const instance =
            source.cloneNode();

        instance.volume =
            source.volume;

        trackSfxInstance(key, instance);
        instance._playPromise =
            safePlay(instance);

        return instance;
    };

    const stopSfx = (key) => {
        const instances =
            activeSfxInstances[key];

        if (!instances) {
            return;
        }

        instances.forEach((instance) => {
            stopAudio(instance);
        });

        instances.clear();
    };

    const playButtonClick = () => {
        const buttonSound =
            sfx.button;

        if (!buttonSound || !unlocked) {
            return;
        }

        buttonSound.pause();
        buttonSound.currentTime = 0;
        safePlay(buttonSound);
    };

    const startEvacAlarm = () => {
        if (!unlocked || alarmPlaying) {
            return;
        }

        alarmPlaying = true;
        if (currentMusic) {
            currentMusic.volume = 0.10;
        }
        sfx.evacuationAlarm.volume = 0.70;
        sfx.evacuationAlarm.currentTime = 0;
        safePlay(sfx.evacuationAlarm);
    };

    const stopEvacAlarm = () => {
        if (!alarmPlaying) {
            return;
        }

        stopAudio(sfx.evacuationAlarm);
        alarmPlaying = false;
        sfx.evacuationAlarm.volume =
            sfxVolumes.evacuationAlarm;

        if (currentMusic) {
            currentMusic.volume = musicVolume;
        }
    };

    return {
        unlock() {
            unlocked = true;

            if (pendingLevelMusic !== null) {
                playLevelMusic(pendingLevelMusic);
            }
        },
        playLevelMusic,
        loadLevelAudio(level) {
            const track =
                musicTracks[level];

            if (!track) {
                return Promise.resolve(null);
            }

            return loadAudioResource(
                track,
                `audio:music:${level}`
            );
        },
        stopMusic,
        playSfx,
        startEvacAlarm,
        stopEvacAlarm,
        stopSfx,
        playButtonClick,
        pauseSfxInstance(audio) {
            if (audio && !audio.paused) {
                audio.pause();
            }
        },
        resumeSfxInstance(audio) {
            if (audio && audio.paused && !audio.ended) {
                safePlay(audio);
            }
        },
        stopSfxInstance(audio) {
            if (audio) {
                stopAudio(audio);
            }
        },
        pauseGameplayAudio() {
            musicPausedByGame =
                Boolean(currentMusic && !currentMusic.paused);
            alarmPausedByGame =
                Boolean(alarmPlaying && !sfx.evacuationAlarm.paused);

            if (musicPausedByGame) {
                currentMusic.pause();
            }

            if (alarmPausedByGame) {
                sfx.evacuationAlarm.pause();
            }
        },
        resumeGameplayAudio() {
            if (musicPausedByGame && currentMusic) {
                safePlay(currentMusic);
            }

            if (alarmPausedByGame && alarmPlaying) {
                safePlay(sfx.evacuationAlarm);
            }

            musicPausedByGame = false;
            alarmPausedByGame = false;
        },
        playGameOver() {
            if (gameOverPlayed || !unlocked) {
                return;
            }

            gameOverPlayed = true;
            stopSfx("lostEnergy");
            stopMusic();
            stopEvacAlarm();
            playSfx("gameOver");
        },
        playVictory() {
            if (victoryPlayed || !unlocked) {
                return;
            }

            victoryPlayed = true;
            stopMusic();
            stopEvacAlarm();
            playSfx("victory");
        }
    };
})();


/* ===============================
   ILUMINACIÓN
================================ */

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.5
);

scene.add(ambientLight);


const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        3
    );

directionalLight.position.set(
    5,
    10,
    5
);

directionalLight.castShadow = true;

scene.add(directionalLight);
function setLevel2Lighting() {

    // Luz ambiental fría del laboratorio
    ambientLight.color.set(0x8fbfff);
    ambientLight.intensity = 0.85;

    // Luz principal azulada
    directionalLight.color.set(0xb8d8ff);
    directionalLight.intensity = 1.8;

    directionalLight.position.set(
        -4,
        9,
        3
    );
}
function setLevel3Lighting() {

    // Ambiente oscuro y frío del Reactor Zero
    ambientLight.color.set(0x3f5f78);
    ambientLight.intensity = 0.55;

    // Luz principal fría con tono azulado
    directionalLight.color.set(0x7fa6c9);
    directionalLight.intensity = 1.15;

    directionalLight.position.set(
        -3,
        8,
        4
    );
}

function setLevel3EmergencyLighting() {

    ambientLight.color.set(0xff6b4a);
    ambientLight.intensity = 0.78;

    directionalLight.color.set(0xffb38a);
    directionalLight.intensity = 1.65;

    directionalLight.position.set(
        -5,
        9,
        2
    );
}


/* ===============================
   PISO TEMPORAL
================================ */

const floorGeometry =
    new THREE.PlaneGeometry(
        30,
        30
    );

const floorMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x303840,
        roughness: 0.8
    });

const floor =
    new THREE.Mesh(
        floorGeometry,
        floorMaterial
    );

floor.rotation.x = -Math.PI / 2;

floor.receiveShadow = true;

scene.add(floor);
/* ===============================
   FONDO INDUSTRIAL
================================ */

const industrialBackground = new THREE.Group();

scene.add(industrialBackground);

const backgroundMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x18232b,
        roughness: 0.9,
        metalness: 0.3
    });

const towerMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x24343d,
        roughness: 0.85,
        metalness: 0.4
    });
const warningLightMaterial =
    new THREE.MeshBasicMaterial({
        color: 0xff3b30
    });
function createBackgroundBuilding(
    x,
    y,
    z,
    width,
    height,
    depth
) {

    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );

    const building =
        new THREE.Mesh(
            geometry,
            backgroundMaterial
        );

    building.position.set(
        x,
        y + height / 2,
        z
    );

    industrialBackground.add(building);

}
createBackgroundBuilding(
    -20, 0, -35,
    8, 18, 8
);

createBackgroundBuilding(
    -8, 0, -42,
    10, 28, 10
);

createBackgroundBuilding(
    8, 0, -38,
    12, 22, 10
);

createBackgroundBuilding(
    22, 0, -45,
    9, 32, 9
);

createBackgroundBuilding(
    35, 0, -40,
    14, 20, 12
);
createBackgroundBuilding(
    -22, 0, 35,
    10, 22, 10
);

createBackgroundBuilding(
    -8, 0, 42,
    12, 30, 12
);

createBackgroundBuilding(
    10, 0, 38,
    9, 20, 9
);

createBackgroundBuilding(
    25, 0, 44,
    12, 27, 12
);
createBackgroundBuilding(
    -38, 0, -20,
    10, 24, 10
);

createBackgroundBuilding(
    -42, 0, -5,
    12, 32, 12
);

createBackgroundBuilding(
    -38, 0, 12,
    9, 19, 9
);

createBackgroundBuilding(
    -45, 0, 27,
    14, 28, 12
);
createBackgroundBuilding(
    38, 0, -22,
    10, 26, 10
);

createBackgroundBuilding(
    43, 0, -7,
    12, 20, 12
);

createBackgroundBuilding(
    39, 0, 10,
    10, 31, 10
);

createBackgroundBuilding(
    44, 0, 27,
    14, 23, 12
);
createIndustrialTower(
    -15,
    -40,
    22
);

createIndustrialTower(
    16,
    -44,
    30
);

createIndustrialTower(
    -38,
    8,
    26
);

createIndustrialTower(
    40,
    -5,
    32
);

createIndustrialTower(
    -15,
    40,
    28
);

createIndustrialTower(
    18,
    42,
    24
);
// Zona trasera
createIndustrialBridge(
    0,
    14,
    -40,
    26,
    0
);

// Zona frontal exterior
createIndustrialBridge(
    2,
    17,
    40,
    28,
    0
);

// Lateral izquierdo
createIndustrialBridge(
    -40,
    15,
    0,
    25,
    Math.PI / 2
);

// Lateral derecho
createIndustrialBridge(
    40,
    18,
    2,
    28,
    Math.PI / 2
);

function createIndustrialTower(x, z, height) {

    const towerGroup = new THREE.Group();

    // Cuerpo principal
    const bodyGeometry =
        new THREE.CylinderGeometry(
            2.2,
            2.8,
            height,
            8
        );

    const body =
        new THREE.Mesh(
            bodyGeometry,
            towerMaterial
        );

    body.position.y = height / 2;

    towerGroup.add(body);

    // Parte superior
    const topGeometry =
        new THREE.CylinderGeometry(
            1.5,
            2.2,
            3,
            8
        );

    const top =
        new THREE.Mesh(
            topGeometry,
            towerMaterial
        );

    top.position.y =
        height + 1.5;

    towerGroup.add(top);

    // Chimenea
    const chimneyGeometry =
        new THREE.CylinderGeometry(
            0.45,
            0.65,
            7,
            8
        );

    const chimney =
        new THREE.Mesh(
            chimneyGeometry,
            towerMaterial
        );

    chimney.position.y =
        height + 6;

    towerGroup.add(chimney);
    // Luz de advertencia superior
    const warningGeometry =
        new THREE.SphereGeometry(
            0.35,
            8,
            8
        );

    const warningLight =
        new THREE.Mesh(
            warningGeometry,
            warningLightMaterial
        );

    warningLight.position.y =
        height + 9.7;

    towerGroup.add(
        warningLight
    );
    // Resplandor ambiental de la torre
    const warningGlow =
        new THREE.PointLight(
            0xff3b30,
            12,
            40,
            1.5
        );

    warningGlow.position.y =
        height + 4;

    towerGroup.add(
        warningGlow
    );

    towerGroup.position.set(
        x,
        0,
        z
    );

    industrialBackground.add(
        towerGroup
    );
    // Halo industrial ambiental
    const glowGeometry =
        new THREE.SphereGeometry(
            8,
            16,
            16
        );

    const glowMaterial =
        new THREE.ShaderMaterial({

            transparent: true,
            depthWrite: false,

            blending:
                THREE.AdditiveBlending,

            uniforms: {
                glowColor: {
                    value:
                        new THREE.Color(
                            0xff4d2e
                        )
                }
            },

            vertexShader: `
            varying vec3 vNormal;

            void main() {

                vNormal =
                    normalize(
                        normalMatrix * normal
                    );

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

            fragmentShader: `
            varying vec3 vNormal;

            uniform vec3 glowColor;

            void main() {

                float intensity =
                    pow(
                        1.0 -
                        abs(vNormal.z),
                        2.5
                    );

                gl_FragColor =
                    vec4(
                        glowColor,
                        intensity * 0.05
                    );
            }
        `
        });


    const industrialGlow =
        new THREE.Mesh(
            glowGeometry,
            glowMaterial
        );

    industrialGlow.position.set(
        0,
        height * 0.45,
        0
    );

    towerGroup.add(
        industrialGlow
    );
}
function createIndustrialBridge(
    x,
    y,
    z,
    width,
    rotationY = 0
) {
    const geometry =
        new THREE.BoxGeometry(
            width,
            1.2,
            1.4
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x2d3d46,
            roughness: 0.8,
            metalness: 0.45
        });

    const bridge =
        new THREE.Mesh(
            geometry,
            material
        );

    bridge.position.set(
        x,
        y,
        z
    );

    bridge.rotation.y =
        rotationY;

    industrialBackground.add(
        bridge
    );
}

function createLevel1IndustrialBackdrop(options = {}) {

    const config = {
        name: "level1IndustrialBackdrop",
        fogColor: 0x11191f,
        fogDensity: 0.018,
        ceilingSize: [42, 0.6, 34],
        ceilingY: 13.8,
        beamZLength: 33,
        crossBeamWidth: 40,
        pipeRuns: [
            { position: [-7, 10.8, -14.8], length: 18, axis: "x" },
            { position: [8, 11.3, 14.7], length: 20, axis: "x" },
            { position: [-18.5, 9.8, 0], length: 22, axis: "z" },
            { position: [18.5, 10.6, -1], length: 18, axis: "z" }
        ],
        lightPositions: [
            [-9, 12.2, -8],
            [9, 12.2, -8],
            [-9, 12.2, 8],
            [9, 12.2, 8]
        ],
        skipDoorOpening: true,
        ...options
    };

    clearLevel1IndustrialBackdrop();

    level1PreviousFog = scene.fog;
    level1FogOverridden = true;
    scene.fog = new THREE.FogExp2(
        config.fogColor,
        config.fogDensity
    );

    level1PreviousIndustrialBackgroundVisible =
        industrialBackground.visible;

    industrialBackground.visible = false;

    level1IndustrialBackdrop = new THREE.Group();
    level1IndustrialBackdrop.name =
        config.name;

    const darkMetalMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x10171c,
            roughness: 0.92,
            metalness: 0.45
        });

    const beamMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x18242b,
            roughness: 0.85,
            metalness: 0.55
        });

    const pipeMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x26343a,
            roughness: 0.82,
            metalness: 0.6
        });

    const lightMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x8fd8ff
        });

    level1IndustrialBackdrop.userData.ownedMaterials = [
        darkMetalMaterial,
        beamMaterial,
        pipeMaterial,
        lightMaterial
    ];

    level1IndustrialBackdrop.userData.ownedGeometries = [];

    const ceiling =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                config.ceilingSize[0],
                config.ceilingSize[1],
                config.ceilingSize[2]
            ),
            darkMetalMaterial
        );

    level1IndustrialBackdrop
        .userData
        .ownedGeometries
        .push(ceiling.geometry);

    ceiling.name = "level1IndustrialBackdropCeiling";
    ceiling.position.set(0, config.ceilingY, 0);
    ceiling.receiveShadow = false;
    level1IndustrialBackdrop.add(ceiling);

    const beamPositions = [-14, -7, 0, 7, 14];
    const backdropBeams = [];

    beamPositions.forEach((x) => {

        const beam =
            new THREE.Mesh(
                new THREE.BoxGeometry(0.45, 0.75, config.beamZLength),
                beamMaterial
            );

        level1IndustrialBackdrop
            .userData
            .ownedGeometries
            .push(beam.geometry);

        beam.position.set(x, 13.1, 0);
        level1IndustrialBackdrop.add(beam);
        backdropBeams.push(beam);
    });

    const backdropCrossBeams = [];

    [-11, 0, 11].forEach((z) => {

        const crossBeam =
            new THREE.Mesh(
                new THREE.BoxGeometry(config.crossBeamWidth, 0.55, 0.45),
                beamMaterial
            );

        level1IndustrialBackdrop
            .userData
            .ownedGeometries
            .push(crossBeam.geometry);

        crossBeam.position.set(0, 12.7, z);
        level1IndustrialBackdrop.add(crossBeam);
        backdropCrossBeams.push(crossBeam);
    });

    level1IndustrialBackdrop.userData.ceiling = ceiling;
    level1IndustrialBackdrop.userData.beams = backdropBeams;
    level1IndustrialBackdrop.userData.crossBeams = backdropCrossBeams;

    createLevel1BackdropWallModules(
        level1IndustrialBackdrop,
        config
    );

    config.pipeRuns.forEach((pipeRun) => {

        const pipe =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.18,
                    0.18,
                    pipeRun.length,
                    12
                ),
                pipeMaterial
            );

        level1IndustrialBackdrop
            .userData
            .ownedGeometries
            .push(pipe.geometry);

        if (pipeRun.axis === "x") {
            pipe.rotation.z = Math.PI / 2;
        } else {
            pipe.rotation.x = Math.PI / 2;
        }

        pipe.position.set(
            pipeRun.position[0],
            pipeRun.position[1],
            pipeRun.position[2]
        );

        level1IndustrialBackdrop.add(pipe);
    });

    const backdropFixtures = [];
    const backdropLights = [];

    config.lightPositions.forEach((position) => {

        const fixture =
            new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 0.15, 0.45),
                lightMaterial
            );

        level1IndustrialBackdrop
            .userData
            .ownedGeometries
            .push(fixture.geometry);

        fixture.position.set(
            position[0],
            position[1],
            position[2]
        );

        level1IndustrialBackdrop.add(fixture);
        backdropFixtures.push(fixture);

        const light =
            new THREE.PointLight(
                0x77cfff,
                0.45,
                10,
                2
            );

        light.position.set(
            position[0],
            position[1] - 0.2,
            position[2]
        );

        level1IndustrialBackdrop.add(light);
        backdropLights.push(light);
    });

    level1IndustrialBackdrop.userData.fixtures =
        backdropFixtures;
    level1IndustrialBackdrop.userData.lights =
        backdropLights;

    scene.add(level1IndustrialBackdrop);
}

function createLevel1BackdropWallModules(
    backdropGroup,
    options = {}
) {

    const wallOverlap = 0.035;
    const ceilingThickness = 0.6;
    const backX =
        options.backX || [-12, -8, -4, 0, 4, 8, 12];
    const sideZ =
        options.sideZ || [-8, -4, 0, 4, 8];
    const frontX =
        options.frontX || [-12, -8, -4, 0, 4, 8, 12];
    const leftX =
        options.leftX ?? -16;
    const rightX =
        options.rightX ?? 16;
    const backZ =
        options.backZ ?? -12;
    const frontZ =
        options.frontZ ?? 12;
    const skipDoorOpening =
        options.skipDoorOpening === true;

    const moduleAssets = {
        straight:
            "./assets/models/environment/level1/walls/WallAstra_Straight.gltf",
        window:
            "./assets/models/environment/level1/walls/WallAstra_Straight_Window.gltf",
        cornerInner:
            "./assets/models/environment/level1/walls/WallAstra_Corner_Square_Inner.gltf",
        topAstra:
            "./assets/models/environment/level1/walls/TopAstra_Straight.gltf",
        topCable:
            "./assets/models/environment/level1/walls/TopCables_Straight.gltf",
        topCableHanging:
            "./assets/models/environment/level1/walls/TopCables_Straight_Hanging.gltf",
        topCableCorner:
            "./assets/models/environment/level1/walls/TopCables_Corner_Square_Inner.gltf"
    };

    const moduleLibrary = {};
    const modulesGroup = new THREE.Group();
    modulesGroup.name = "level1IndustrialBackdropModules";
    backdropGroup.add(modulesGroup);

    const loadModule = (key, path) => {

        loader.load(
            path,
            (gltf) => {

                if (level1IndustrialBackdrop !== backdropGroup) {
                    return;
                }

                moduleLibrary[key] = gltf.scene;

                gltf.scene.traverse((child) => {

                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;
                    }
                });

                buildLevel1BackdropWallModules(
                    modulesGroup,
                    moduleLibrary
                );
            },
            undefined,
            (error) => {
                console.error(
                    `Error cargando módulo visual ${key}:`,
                    error
                );
            }
        );
    };

    Object
        .entries(moduleAssets)
        .forEach(([key, path]) => {
            loadModule(key, path);
        });

    function buildLevel1BackdropWallModules(
        targetGroup,
        library
    ) {

        if (
            !library.straight ||
            !library.window ||
            !library.cornerInner ||
            !library.topAstra ||
            !library.topCable ||
            !library.topCableHanging ||
            !library.topCableCorner
        ) {
            return;
        }

        targetGroup.clear();

        const getModelMetrics = (model) => {

            const box =
                new THREE.Box3().setFromObject(model);

            const size =
                new THREE.Vector3();

            box.getSize(size);

            return {
                minY: box.min.y,
                maxY: box.max.y,
                height: size.y
            };
        };

        const straightMetrics =
            getModelMetrics(library.straight);

        const topAstraMetrics =
            getModelMetrics(library.topAstra);

        const topCableMetrics =
            getModelMetrics(library.topCable);

        const topCableHangingMetrics =
            getModelMetrics(library.topCableHanging);

        const topCableCornerMetrics =
            getModelMetrics(library.topCableCorner);

        const originalWallMaxY =
            straightMetrics.maxY;

        const upperWallBaseY =
            originalWallMaxY -
            straightMetrics.minY -
            wallOverlap;

        const firstRowMaxY =
            upperWallBaseY +
            straightMetrics.maxY;

        const upperWallSecondRowY =
            firstRowMaxY -
            straightMetrics.minY -
            wallOverlap;

        const secondRowMaxY =
            upperWallSecondRowY +
            straightMetrics.maxY;

        const topTrimY =
            secondRowMaxY -
            topAstraMetrics.minY -
            wallOverlap;

        const topTrimMaxY =
            topTrimY +
            topAstraMetrics.maxY;

        const topCablesY =
            topTrimMaxY -
            topCableMetrics.minY -
            wallOverlap;

        const topCablesMaxY =
            Math.max(
                topCablesY + topCableMetrics.maxY,
                topCablesY + topCableHangingMetrics.maxY,
                topCablesY + topCableCornerMetrics.maxY
            );

        const ceilingBottomY =
            topCablesMaxY -
            wallOverlap;

        const ceilingCenterY =
            ceilingBottomY +
            ceilingThickness / 2;

        if (backdropGroup.userData.ceiling) {
            backdropGroup.userData.ceiling.position.y =
                ceilingCenterY;
        }

        if (backdropGroup.userData.beams) {
            backdropGroup.userData.beams.forEach((beam) => {
                beam.position.y =
                    ceilingBottomY - 0.7;
            });
        }

        if (backdropGroup.userData.crossBeams) {
            backdropGroup.userData.crossBeams.forEach((beam) => {
                beam.position.y =
                    ceilingBottomY - 1.1;
            });
        }

        if (backdropGroup.userData.fixtures) {
            backdropGroup.userData.fixtures.forEach((fixture) => {
                fixture.position.y =
                    ceilingBottomY - 1.45;
            });
        }

        if (backdropGroup.userData.lights) {
            backdropGroup.userData.lights.forEach((light) => {
                light.position.y =
                    ceilingBottomY - 1.65;
            });
        }

        backdropGroup.userData.wallMetrics = {
            originalWallMaxY,
            wallModuleHeight: straightMetrics.height,
            wallModuleMinY: straightMetrics.minY,
            wallModuleMaxY: straightMetrics.maxY,
            firstRowY: upperWallBaseY,
            secondRowY: upperWallSecondRowY,
            ceilingBottomY
        };
        backdropGroup.userData.rebuildLevel1BackdropWallModules =
            () => {
                buildLevel1BackdropWallModules(
                    targetGroup,
                    library
                );
            };

        const addModule = (
            key,
            x,
            y,
            z,
            rotationY
        ) => {

            if (!key || !library[key]) {
                return;
            }

            const module =
                library[key].clone(true);

            module.position.set(
                x,
                y,
                z
            );

            module.rotation.y = rotationY;

            targetGroup.add(module);
        };

        const straightRows = [
            {
                index: 0,
                y: upperWallBaseY,
                back: backX.map((_, index) =>
                    index % 3 === 2 ? "window" : "straight"
                ),
                left: sideZ.map((_, index) =>
                    index % 4 === 1 ? "window" : "straight"
                ),
                right: sideZ.map((_, index) =>
                    index % 3 === 0 ? "window" : "straight"
                ),
                front: frontX.map((_, index) =>
                    index % 4 === 1 ? "window" : "straight"
                )
            },
            {
                index: 1,
                y: upperWallSecondRowY,
                back: backX.map((_, index) =>
                    index % 3 === 0 ? "window" : "straight"
                ),
                left: sideZ.map((_, index) =>
                    index % 3 === 2 ? "window" : "straight"
                ),
                right: sideZ.map((_, index) =>
                    index % 3 === 1 ? "window" : "straight"
                ),
                front: frontX.map((_, index) =>
                    index % 3 === 0 ? "window" : "straight"
                )
            }
        ];

        const rowDefinitions = [
            ["back", backX],
            ["left", sideZ],
            ["right", sideZ],
            ["front", frontX]
        ];

        const rowsHaveValidLengths =
            straightRows.every((row) => {
                return rowDefinitions.every(([side, positions]) => {
                    return row[side].length === positions.length;
                });
            });

        if (!rowsHaveValidLengths) {
            return;
        }

        const getDoorBox = () => {

            if (!doorFrameModel) {
                return null;
            }

            doorFrameModel.updateMatrixWorld(true);

            return new THREE.Box3().setFromObject(doorFrameModel);
        };

        const frontDoorBox =
            getDoorBox();

        const skippedFirstRowFrontModules = [];

        const shouldSkipFirstRowFrontModule = (
            key,
            x,
            y,
            z,
            rotationY
        ) => {

            if (!frontDoorBox) {
                return false;
            }

            const candidate =
                library[key].clone(true);

            candidate.position.set(
                x,
                y,
                z
            );

            candidate.rotation.y = rotationY;
            candidate.updateMatrixWorld(true);

            const candidateBox =
                new THREE.Box3().setFromObject(candidate);

            return candidateBox.intersectsBox(frontDoorBox);
        };

        straightRows.forEach((row) => {

            backX.forEach((x, index) => {
                addModule(
                    row.back[index],
                    x,
                    row.y,
                    backZ,
                    Math.PI / 2
                );
            });

            sideZ.forEach((z, index) => {
                addModule(
                    row.left[index],
                    leftX,
                    row.y,
                    z,
                    Math.PI
                );

                addModule(
                    row.right[index],
                    rightX,
                    row.y,
                    z,
                    0
                );
            });

            frontX.forEach((x, index) => {

                if (
                    skipDoorOpening &&
                    row.index === 0 &&
                    shouldSkipFirstRowFrontModule(
                        row.front[index],
                        x,
                        row.y,
                        frontZ,
                        -Math.PI / 2
                    )
                ) {
                    skippedFirstRowFrontModules.push({
                        x,
                        index
                    });
                    return;
                }

                addModule(
                    row.front[index],
                    x,
                    row.y,
                    frontZ,
                    -Math.PI / 2
                );
            });
        });

        backdropGroup.userData.skippedFirstRowFrontModules =
            skippedFirstRowFrontModules;

        const topSegments = [
            {
                positions: backX,
                z: backZ,
                rotation: Math.PI / 2,
                hanging: [2, 5]
            },
            {
                positions: sideZ,
                x: leftX,
                rotation: Math.PI,
                hanging: [1]
            },
            {
                positions: sideZ,
                x: rightX,
                rotation: 0,
                hanging: [3]
            },
            {
                positions: frontX,
                z: frontZ,
                rotation: -Math.PI / 2,
                hanging: [1]
            }
        ];

        topSegments.forEach((segment) => {

            segment.positions.forEach((position, index) => {

                const x =
                    segment.x !== undefined
                        ? segment.x
                        : position;

                const z =
                    segment.z !== undefined
                        ? segment.z
                        : position;

                addModule(
                    "topAstra",
                    x,
                    topTrimY,
                    z,
                    segment.rotation
                );

                addModule(
                    segment.hanging.includes(index)
                        ? "topCableHanging"
                        : "topCable",
                    x,
                    topCablesY,
                    z,
                    segment.rotation
                );
            });
        });

        const corners = [
            { x: leftX, z: backZ, rotation: Math.PI },
            { x: rightX, z: backZ, rotation: Math.PI / 2 },
            { x: leftX, z: frontZ, rotation: -Math.PI / 2 },
            { x: rightX, z: frontZ, rotation: 0 }
        ];

        corners.forEach((corner) => {

            addModule(
                "cornerInner",
                corner.x,
                upperWallBaseY,
                corner.z,
                corner.rotation
            );

            addModule(
                "cornerInner",
                corner.x,
                upperWallSecondRowY,
                corner.z,
                corner.rotation
            );

            addModule(
                "topCableCorner",
                corner.x,
                topCablesY,
                corner.z,
                corner.rotation
            );
        });
    }


}

function clearLevel1IndustrialBackdrop() {

    if (!level1IndustrialBackdrop) {
        return;
    }

    scene.remove(level1IndustrialBackdrop);

    if (level1IndustrialBackdrop.userData.ownedGeometries) {

        level1IndustrialBackdrop
            .userData
            .ownedGeometries
            .forEach((geometry) => {
                geometry.dispose();
            });
    }

    if (level1IndustrialBackdrop.userData.ownedMaterials) {

        level1IndustrialBackdrop
            .userData
            .ownedMaterials
            .forEach((material) => {
                material.dispose();
            });
    }

    level1IndustrialBackdrop = null;

    if (level1FogOverridden) {
        scene.fog = level1PreviousFog;
        level1PreviousFog = null;
        level1FogOverridden = false;
    }

    industrialBackground.visible =
        level1PreviousIndustrialBackgroundVisible;
}

createLevel1IndustrialBackdrop();

function createLevel2IndustrialBackdrop() {

    createLevel1IndustrialBackdrop({
        name: "level2IndustrialBackdrop",
        fogColor: 0x071118,
        fogDensity: 0.014,
        ceilingSize: [44, 0.6, 36],
        beamZLength: 35,
        crossBeamWidth: 42,
        pipeRuns: [
            { position: [-9, 10.6, -14.8], length: 20, axis: "x" },
            { position: [9, 10.9, 14.8], length: 20, axis: "x" },
            { position: [-18.5, 10.2, 0], length: 20, axis: "z" },
            { position: [18.5, 10.2, 0], length: 20, axis: "z" }
        ],
        lightPositions: [
            [-10, 12.1, -7],
            [10, 12.1, -7],
            [-10, 12.1, 7],
            [10, 12.1, 7]
        ],
        skipDoorOpening: false
    });
}

function createLevel3IndustrialBackdrop() {

    createLevel1IndustrialBackdrop({
        name: "level3IndustrialBackdrop",
        fogColor: 0x130908,
        fogDensity: 0.012,
        ceilingSize: [46, 0.6, 38],
        beamZLength: 37,
        crossBeamWidth: 44,
        pipeRuns: [
            { position: [-10, 10.8, -15.5], length: 22, axis: "x" },
            { position: [10, 10.8, 15.5], length: 22, axis: "x" },
            { position: [-19.2, 10.4, 0], length: 22, axis: "z" },
            { position: [19.2, 10.4, 0], length: 22, axis: "z" }
        ],
        lightPositions: [
            [-11, 12.1, -8],
            [11, 12.1, -8],
            [-11, 12.1, 8],
            [11, 12.1, 8]
        ],
        skipDoorOpening: false
    });
}

/* ===============================
   PISO MODULAR - NIVEL 1
================================ */

loader.load(
    "./assets/models/environment/level1/platforms/Platform_Metal.gltf",

    function (gltf) {

        const platformOriginal = gltf.scene;

        platformOriginal.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });

        // Crear una cuadrícula de plataformas
        const floorGroup = new THREE.Group();

        for (let x = -3; x <= 3; x++) {

            for (let z = -2; z <= 2; z++) {

                const platform =
                    platformOriginal.clone(true);

                platform.position.set(
                    x * 4,
                    0.05,
                    z * 4
                );

                floorGroup.add(platform);
            }
        }

        scene.add(floorGroup);

        console.log(
            "Piso modular del Nivel 1 cargado correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando el piso modular:",
            error
        );

    }
);
/* ===============================
   PARED DEL FONDO - NIVEL 1
================================ */

loader.load(
    "./assets/models/environment/level1/walls/WallAstra_Straight.gltf",

    function (gltf) {

        const wallOriginal = gltf.scene;
        wallAstraOriginalModel = wallOriginal;

        wallOriginal.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });

        // ===============================
        // PARED DEL FONDO
        // ===============================
        for (let x = -3; x <= 3; x++) {

            const wall = wallOriginal.clone(true);

            // Girar 90 grados para que el ancho
            // de la pared quede sobre el eje X
            wall.rotation.y = Math.PI / 2;

            wall.position.set(
                x * 4,
                0,
                -12
            );

            scene.add(wall);
            registerCameraObstacle(wall);
        }
        // ===============================
        // PARED LATERAL IZQUIERDA
        // ===============================

        const leftWallGroup = new THREE.Group();

        for (let z = -2; z <= 2; z++) {

            const wall = wallOriginal.clone(true);

            // Aquí NO se gira.
            // El modelo original ya mide 4 unidades sobre Z.
            wall.rotation.y = Math.PI;

            wall.position.set(
                -16,
                0,
                z * 4
            );

            leftWallGroup.add(wall);
        }

        scene.add(leftWallGroup);
        registerCameraObstacle(leftWallGroup);
        // ===============================
        // PARED LATERAL DERECHA
        // ===============================

        const rightWallGroup = new THREE.Group();

        for (let z = -2; z <= 2; z++) {

            const wall = wallOriginal.clone(true);

            // El modelo original se extiende sobre Z
            wall.rotation.y = 0;

            wall.position.set(
                16,
                0,
                z * 4
            );

            rightWallGroup.add(wall);
        }

        scene.add(rightWallGroup);
        registerCameraObstacle(rightWallGroup);

        // ===============================
        // PARED FRONTAL
        // ===============================

        const frontWallPositions = [-12, -8, -4, 8, 12];

        const frontLeftWallGroup = new THREE.Group();
        const frontRightWallGroup = new THREE.Group();
        frontLeftWallGroupModel = frontLeftWallGroup;
        frontRightWallGroupModel = frontRightWallGroup;

        frontWallPositions.forEach((x) => {

            const wall = wallOriginal.clone(true);

            wall.rotation.y = - Math.PI / 2;

            wall.position.set(
                x,
                0,
                12
            );

            if (x < 0) {
                frontLeftWallGroup.add(wall);
            } else {
                frontRightWallGroup.add(wall);
            }
        });

        scene.add(frontLeftWallGroup);
        scene.add(frontRightWallGroup);

        const leftWallBox =
            new THREE.Box3().setFromObject(leftWallGroup);
        const leftWallCenter =
            new THREE.Vector3();
        const leftWallSize =
            new THREE.Vector3();

        leftWallBox.getCenter(leftWallCenter);
        leftWallBox.getSize(leftWallSize);

        const leftWallBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc
                    .fixed()
                    .setTranslation(
                        leftWallCenter.x,
                        leftWallCenter.y,
                        leftWallCenter.z
                    )
            );

        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                leftWallSize.x / 2,
                leftWallSize.y / 2,
                leftWallSize.z / 2
            ),
            leftWallBody
        );

        const rightWallBox =
            new THREE.Box3().setFromObject(rightWallGroup);
        const rightWallCenter =
            new THREE.Vector3();
        const rightWallSize =
            new THREE.Vector3();

        rightWallBox.getCenter(rightWallCenter);
        rightWallBox.getSize(rightWallSize);


        console.log("DIAGNÓSTICO PARED DERECHA", {
            center: {
                x: rightWallCenter.x,
                y: rightWallCenter.y,
                z: rightWallCenter.z
            },
            size: {
                x: rightWallSize.x,
                y: rightWallSize.y,
                z: rightWallSize.z
            },
            box: {
                minX: rightWallBox.min.x,
                maxX: rightWallBox.max.x,
                minZ: rightWallBox.min.z,
                maxZ: rightWallBox.max.z
            }
        });

        const rightWallBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc
                    .fixed()
                    .setTranslation(
                        rightWallCenter.x,
                        rightWallCenter.y,
                        rightWallCenter.z
                    )
            );

        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                rightWallSize.x / 2,
                rightWallSize.y / 2,
                rightWallSize.z / 2
            ),
            rightWallBody
        );

        const frontLeftWallBox =
            new THREE.Box3().setFromObject(frontLeftWallGroup);
        const frontLeftWallCenter =
            new THREE.Vector3();
        const frontLeftWallSize =
            new THREE.Vector3();

        frontLeftWallBox.getCenter(frontLeftWallCenter);
        frontLeftWallBox.getSize(frontLeftWallSize);

        const frontLeftWallBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc
                    .fixed()
                    .setTranslation(
                        frontLeftWallCenter.x,
                        frontLeftWallCenter.y,
                        frontLeftWallCenter.z
                    )
            );

        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                frontLeftWallSize.x / 2,
                frontLeftWallSize.y / 2,
                frontLeftWallSize.z / 2
            ),
            frontLeftWallBody
        );

        const frontRightWallBox =
            new THREE.Box3().setFromObject(frontRightWallGroup);
        const frontRightWallCenter =
            new THREE.Vector3();
        const frontRightWallSize =
            new THREE.Vector3();

        frontRightWallBox.getCenter(frontRightWallCenter);
        frontRightWallBox.getSize(frontRightWallSize);

        const frontRightWallBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc
                    .fixed()
                    .setTranslation(
                        frontRightWallCenter.x,
                        frontRightWallCenter.y,
                        frontRightWallCenter.z
                    )
            );

        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                frontRightWallSize.x / 2,
                frontRightWallSize.y / 2,
                frontRightWallSize.z / 2
            ),
            frontRightWallBody
        );

        console.log(
            "Colliders exteriores del Nivel 1 creados correctamente"
        );

        rebuildFrontFacade();

        console.log(
            "Pared del fondo cargada correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando la pared del fondo:",
            error
        );

    }
);

function rebuildFrontFacade() {

    if (
        !wallAstraOriginalModel ||
        !doorFrameModel
    ) {
        return;
    }

    if (frontLeftWallGroupModel) {
        removeCameraObstacle(frontLeftWallGroupModel);
        scene.remove(frontLeftWallGroupModel);
    }

    if (frontRightWallGroupModel) {
        removeCameraObstacle(frontRightWallGroupModel);
        scene.remove(frontRightWallGroupModel);
    }

    frontLeftWallGroupModel = new THREE.Group();
    frontRightWallGroupModel = new THREE.Group();

    const doorBox =
        new THREE.Box3().setFromObject(doorFrameModel);
    const baseWall =
        wallAstraOriginalModel.clone(true);

    baseWall.rotation.y = -Math.PI / 2;

    const baseWallBox =
        new THREE.Box3().setFromObject(baseWall);
    const baseWallSize =
        new THREE.Vector3();

    baseWallBox.getSize(baseWallSize);

    const segmentWidth = baseWallSize.x;
    const halfSegmentWidth = segmentWidth / 2;
    const facadeMinX = -14;
    const facadeMaxX = 14;
    const facadeZ = 12;
    const separation = 0.05;
    const leftLimit = doorBox.min.x - separation;
    const rightLimit = doorBox.max.x + separation;

    function addFrontWallSegment(x) {

        const wall =
            wallAstraOriginalModel.clone(true);

        wall.rotation.y = -Math.PI / 2;

        wall.position.set(
            x,
            0,
            facadeZ
        );

        if (x < doorBox.min.x) {
            frontLeftWallGroupModel.add(wall);
        } else {
            frontRightWallGroupModel.add(wall);
        }
    }

    for (
        let x = facadeMinX + halfSegmentWidth;
        x + halfSegmentWidth <= leftLimit;
        x += segmentWidth
    ) {
        addFrontWallSegment(x);
    }

    for (
        let x = facadeMaxX - halfSegmentWidth;
        x - halfSegmentWidth >= rightLimit;
        x -= segmentWidth
    ) {
        addFrontWallSegment(x);
    }

    scene.add(frontLeftWallGroupModel);
    scene.add(frontRightWallGroupModel);
    registerCameraObstacle(frontLeftWallGroupModel);
    registerCameraObstacle(frontRightWallGroupModel);
    // Collider actualizado para la pared frontal derecha reconstruida
    frontRightWallGroupModel.updateMatrixWorld(true);

    const rebuiltFrontRightBox =
        new THREE.Box3().setFromObject(frontRightWallGroupModel);

    const rebuiltFrontRightCenter =
        new THREE.Vector3();

    const rebuiltFrontRightSize =
        new THREE.Vector3();

    rebuiltFrontRightBox.getCenter(rebuiltFrontRightCenter);
    rebuiltFrontRightBox.getSize(rebuiltFrontRightSize);

    const rebuiltFrontRightBody =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    rebuiltFrontRightCenter.x,
                    rebuiltFrontRightCenter.y,
                    rebuiltFrontRightCenter.z
                )
        );

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            rebuiltFrontRightSize.x / 2,
            rebuiltFrontRightSize.y / 2,
            rebuiltFrontRightSize.z / 2
        ),
        rebuiltFrontRightBody
    );

    if (frontDoorFillersGroup) {
        scene.remove(frontDoorFillersGroup);
    }

    frontDoorFillersGroup = new THREE.Group();

    const updatedLeftBox =
        new THREE.Box3().setFromObject(frontLeftWallGroupModel);
    const updatedRightBox =
        new THREE.Box3().setFromObject(frontRightWallGroupModel);
    const fillerBase =
        wallAstraOriginalModel.clone(true);

    fillerBase.rotation.y = -Math.PI / 2;
    fillerBase.updateMatrixWorld(true);

    const fillerBaseBox =
        new THREE.Box3().setFromObject(fillerBase);
    const fillerBaseSize =
        new THREE.Vector3();
    const fillerScaledBox =
        new THREE.Box3();
    const fillerScaledSize =
        new THREE.Vector3();

    fillerBaseBox.getSize(fillerBaseSize);

    const xAxisTest =
        wallAstraOriginalModel.clone(true);

    xAxisTest.rotation.y = -Math.PI / 2;
    xAxisTest.scale.x = 2;
    xAxisTest.updateMatrixWorld(true);
    fillerScaledBox.setFromObject(xAxisTest);
    fillerScaledBox.getSize(fillerScaledSize);

    const horizontalScaleAxis =
        Math.abs(
            fillerScaledSize.x -
            fillerBaseSize.x
        ) > 0.01
            ? "x"
            : "z";

    function addDoorFiller(minX, maxX) {

        const availableWidth =
            maxX - minX;

        if (availableWidth <= 0) {
            return;
        }

        const filler =
            wallAstraOriginalModel.clone(true);

        filler.rotation.y = -Math.PI / 2;
        filler.scale[horizontalScaleAxis] =
            availableWidth / fillerBaseSize.x;

        filler.position.set(
            (minX + maxX) / 2,
            0,
            facadeZ
        );

        frontDoorFillersGroup.add(filler);
    }

    addDoorFiller(
        updatedLeftBox.max.x,
        doorBox.min.x - 0.03
    );

    addDoorFiller(
        doorBox.max.x + 0.03,
        updatedRightBox.min.x
    );

    scene.add(frontDoorFillersGroup);
    // Collider para los fillers junto al marco de la puerta
    frontDoorFillersGroup.updateMatrixWorld(true);

    frontDoorFillersGroup.children.forEach((filler) => {

        const fillerBox =
            new THREE.Box3().setFromObject(filler);

        const fillerCenter =
            new THREE.Vector3();

        const fillerSize =
            new THREE.Vector3();

        fillerBox.getCenter(fillerCenter);
        fillerBox.getSize(fillerSize);

        const fillerBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc
                    .fixed()
                    .setTranslation(
                        fillerCenter.x,
                        fillerCenter.y,
                        fillerCenter.z
                    )
            );

        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                fillerSize.x / 2,
                fillerSize.y / 2,
                fillerSize.z / 2
            ),
            fillerBody
        );
    });

    createFrontEntranceBarrier();
}

function createFrontEntranceBarrier() {

    if (
        frontEntranceBarrierCreated ||
        !doorFrameModel
    ) {
        return;
    }

    const doorBox =
        new THREE.Box3().setFromObject(doorFrameModel);
    const doorSize =
        new THREE.Vector3();
    const doorCenter =
        new THREE.Vector3();

    doorBox.getCenter(doorCenter);
    doorBox.getSize(doorSize);

    const frontEntranceBarrierBody =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    doorCenter.x,
                    doorCenter.y,
                    doorCenter.z
                )
        );

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            doorSize.x / 2,
            doorSize.y / 2,
            doorSize.z / 2
        ),
        frontEntranceBarrierBody
    );

    frontEntranceBarrierCreated = true;
}

/* ===============================
   ENTRADA PRINCIPAL - NIVEL 1
================================ */

loader.load(
    "./assets/models/environment/level1/platforms/Door_Frame_SquareTall.gltf",

    function (gltf) {

        const doorFrame = gltf.scene;
        doorFrameModel = doorFrame;

        doorFrame.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });

        // Posición temporal para poder observarlo
        doorFrame.position.set(
            2,
            0,
            9.74
        );

        scene.add(doorFrame);

        if (
            level1IndustrialBackdrop &&
            level1IndustrialBackdrop
                .userData
                .rebuildLevel1BackdropWallModules
        ) {
            level1IndustrialBackdrop
                .userData
                .rebuildLevel1BackdropWallModules();
        }

        rebuildFrontFacade();
        createFrontEntranceBarrier();

        console.log(
            "Marco de puerta cargado correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando marco de puerta:",
            error
        );

    }
);




loader.load(
    "./assets/models/environment/level1/platforms/Door_DarkMetal.gltf",

    function (gltf) {

        const door = gltf.scene;

        door.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });

        door.position.set(
            2,
            0,
            9.74
        );

        scene.add(door);

        console.log(
            "Puerta cargada correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando puerta:",
            error
        );

    }
);
/* ===============================
   GENERADORES - NIVEL 1
================================ */

loader.load(
    "./assets/models/props/generators/Prop_AccessPoint.gltf",

    function (gltf) {

        const generatorOriginal = gltf.scene;

        generatorOriginal.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });



        generatorPositions.forEach((position, index) => {

            const generator = generatorOriginal.clone(true);
            generator.traverse((child) => {

                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                }

            });

            generator.rotation.x = -Math.PI / 2;

            generator.position.set(
                position.x,
                position.y,
                position.z
            );

            generator.name = `Generator_${index + 1}`;
            generator.userData.activated = false;
            generator.userData.blocked =
                index === 2;
            generators.push(generator);

            scene.add(generator);
            // ===============================
            // COLLIDER DEL GENERADOR
            // ===============================

            generator.updateMatrixWorld(true);

            const generatorBox =
                new THREE.Box3().setFromObject(generator);

            const generatorCenter =
                new THREE.Vector3();

            const generatorSize =
                new THREE.Vector3();

            generatorBox.getCenter(
                generatorCenter
            );

            generatorBox.getSize(
                generatorSize
            );

            const generatorBody =
                physicsWorld.createRigidBody(
                    RAPIER.RigidBodyDesc
                        .fixed()
                        .setTranslation(
                            generatorCenter.x,
                            generatorCenter.y,
                            generatorCenter.z
                        )
                );

            physicsWorld.createCollider(
                RAPIER.ColliderDesc.cuboid(
                    generatorSize.x / 2,
                    generatorSize.y / 2,
                    generatorSize.z / 2
                ),
                generatorBody
            );

            generator.userData.body =
                generatorBody;
        });

        console.log(
            "3 generadores del Nivel 1 cargados correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando generadores del Nivel 1:",
            error
        );

    }
);

/* ===============================
   CAJAS DINÁMICAS DEL NIVEL 1
================================ */

const dynamicCrates = [];
const usedCratePositions = [];
let dynamicCrateOriginal = null;

loader.load(
    "./assets/models/props/crates/Prop_Crate4.gltf",

    function (gltf) {

        const crateOriginal = gltf.scene;
        dynamicCrateOriginal = crateOriginal;

        crateOriginal.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // ===============================
        // CAJAS DISTRIBUIDAS ALEATORIAMENTE
        // ===============================

        const numberOfRandomCrates = 15;


        for (
            let i = 0;
            i < numberOfRandomCrates;
            i++
        ) {

            let x;
            let z;

            // Evitamos la zona central donde inicia R-0
            let invalidPosition;

            do {

                x = THREE.MathUtils.randFloat(
                    -11,
                    11
                );

                z = THREE.MathUtils.randFloat(
                    -7,
                    7
                );

                // Evitar zona donde inicia R-0
                const nearPlayerStart =
                    Math.abs(x) < 3 &&
                    Math.abs(z) < 3;

                // Evitar los generadores
                const nearGenerator =
                    generatorPositions.some(
                        (generator) => {

                            const dx =
                                x - generator.x;

                            const dz =
                                z - generator.z;

                            const distance =
                                Math.sqrt(
                                    dx * dx +
                                    dz * dz
                                );

                            return distance < 2.5;
                        }
                    );
                // Evitar cajas demasiado juntas
                const nearAnotherCrate =
                    usedCratePositions.some(
                        (cratePosition) => {

                            const dx =
                                x - cratePosition.x;

                            const dz =
                                z - cratePosition.z;

                            const distance =
                                Math.sqrt(
                                    dx * dx +
                                    dz * dz
                                );

                            return distance < 2.2;
                        }
                    );

                invalidPosition =
                    nearPlayerStart ||
                    nearGenerator ||
                    nearAnotherCrate;

            } while (invalidPosition);

            usedCratePositions.push({
                x: x,
                z: z
            });

            createDynamicCrate(
                crateOriginal,
                x,
                1.2,
                z
            );
        }


        // ===============================
        // PILA DE CAJAS
        // ===============================

        createDynamicCrate(
            crateOriginal,
            -10,
            1.2,
            5
        );

        createDynamicCrate(
            crateOriginal,
            -10,
            3.2,
            5
        );

        createDynamicCrate(
            crateOriginal,
            -10,
            5.2,
            5
        );
        // ===============================
        // BLOQUEO FÍSICO - GENERADOR 02
        // ===============================

        createDynamicCrate(
            crateOriginal,
            6.5,
            1.2,
            -3.2
        );

        createDynamicCrate(
            crateOriginal,
            8.3,
            1.2,
            -2.8
        );

        createDynamicCrate(
            crateOriginal,
            9.8,
            1.2,
            -3.6
        );
        createDynamicCrate(
            crateOriginal,
            6.9,
            1.2,
            -5.9
        );

        createDynamicCrate(
            crateOriginal,
            9.2,
            1.2,
            -6.3
        );

        createDynamicCrate(
            crateOriginal,
            10.6,
            1.2,
            -5.1
        );

        console.log(
            "Cajas dinámicas cargadas correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando Prop_Crate4:",
            error
        );
    }
);




/* ===============================
   CREAR CAJA DINÁMICA
================================ */

function createDynamicCrate(
    crateOriginal,
    x,
    y,
    z
) {

    const crate =
        crateOriginal.clone(true);

    crate.position.set(
        x,
        y,
        z
    );

    scene.add(crate);

    crate.updateMatrixWorld(true);

    const crateBox =
        new THREE.Box3().setFromObject(crate);

    const crateSize =
        new THREE.Vector3();

    const crateCenter =
        new THREE.Vector3();

    crateBox.getSize(crateSize);
    crateBox.getCenter(crateCenter);

    // Cuerpo dinámico
    const bodyDesc =
        RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(
                crateCenter.x,
                crateCenter.y,
                crateCenter.z
            );

    const body =
        physicsWorld.createRigidBody(
            bodyDesc
        );

    // Collider
    const colliderDesc =
        RAPIER.ColliderDesc.cuboid(
            crateSize.x / 2,
            crateSize.y / 2,
            crateSize.z / 2
        );

    colliderDesc.setDensity(15);
    colliderDesc.setFriction(0.8);
    colliderDesc.setRestitution(0.1);

    physicsWorld.createCollider(
        colliderDesc,
        body
    );

    // Guardamos juntos modelo + cuerpo físico
    dynamicCrates.push({
        model: crate,
        body: body
    });
}
/* ===============================
   BARRILES DINÁMICOS DEL NIVEL 1
================================ */

const dynamicBarrels = [];
let dynamicBarrelOriginal = null;

loader.load(
    "./assets/models/props/barrels/Prop_Barrel_Large.gltf",

    function (gltf) {

        const barrelOriginal = gltf.scene;
        dynamicBarrelOriginal = barrelOriginal;

        barrelOriginal.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // ===============================
        // GENERAR BARRILES ALEATORIOS
        // ===============================

        const usedBarrelPositions = [];
        const numberOfBarrels = 6;

        for (let i = 0; i < numberOfBarrels; i++) {

            let x;
            let z;
            let invalidPosition;

            do {

                x = THREE.MathUtils.randFloat(
                    -11,
                    11
                );

                z = THREE.MathUtils.randFloat(
                    -7,
                    7
                );

                // Evitar zona inicial de R-0
                const nearPlayerStart =
                    Math.abs(x) < 3 &&
                    Math.abs(z) < 3;

                // Evitar generadores
                const nearGenerator =
                    generatorPositions.some(
                        (generator) => {

                            const dx =
                                x - generator.x;

                            const dz =
                                z - generator.z;

                            const distance =
                                Math.sqrt(
                                    dx * dx +
                                    dz * dz
                                );

                            return distance < 2.5;
                        }
                    );

                // Evitar otros barriles
                const nearAnotherBarrel =
                    usedBarrelPositions.some(
                        (position) => {

                            const dx =
                                x - position.x;

                            const dz =
                                z - position.z;

                            const distance =
                                Math.sqrt(
                                    dx * dx +
                                    dz * dz
                                );

                            return distance < 2.5;
                        }
                    );
                // Evitar cajas
                const nearCrate =
                    usedCratePositions.some(
                        (position) => {

                            const dx =
                                x - position.x;

                            const dz =
                                z - position.z;

                            const distance =
                                Math.sqrt(
                                    dx * dx +
                                    dz * dz
                                );

                            return distance < 2.5;
                        }
                    );

                invalidPosition =
                    nearPlayerStart ||
                    nearGenerator ||
                    nearAnotherBarrel ||
                    nearCrate;

            } while (invalidPosition);

            usedBarrelPositions.push({
                x: x,
                z: z
            });

            createDynamicBarrel(
                barrelOriginal,
                x,
                0.15,
                z
            );
        }

        console.log(
            "Barriles dinámicos cargados correctamente"
        );
    },

    undefined,

    function (error) {

        console.error(
            "Error cargando Prop_Barrel_Large:",
            error
        );
    }
);


/* ===============================
   CREAR BARRIL DINÁMICO
================================ */

function createDynamicBarrel(
    barrelOriginal,
    x,
    y,
    z
) {

    const barrel =
        barrelOriginal.clone(true);

    barrel.scale.set(
        1.5,
        1.5,
        1.5
    );

    barrel.position.set(
        x,
        y,
        z
    );

    scene.add(barrel);

    barrel.updateMatrixWorld(true);

    const barrelBox =
        new THREE.Box3().setFromObject(barrel);

    const barrelSize =
        new THREE.Vector3();

    const barrelCenter =
        new THREE.Vector3();

    barrelBox.getSize(barrelSize);
    barrelBox.getCenter(barrelCenter);

    // Offset individual del modelo
    const modelOffset =
        new THREE.Vector3();

    modelOffset.copy(
        barrel.position
    ).sub(
        barrelCenter
    );

    // Cuerpo dinámico
    const bodyDesc =
        RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(
                barrelCenter.x,
                barrelCenter.y,
                barrelCenter.z
            );

    const body =
        physicsWorld.createRigidBody(
            bodyDesc
        );

    // Collider cilíndrico
    const barrelRadius =
        Math.max(
            barrelSize.x,
            barrelSize.z
        ) / 2;

    const barrelHalfHeight =
        barrelSize.y / 2;

    const colliderDesc =
        RAPIER.ColliderDesc.cylinder(
            barrelHalfHeight,
            barrelRadius
        );

    colliderDesc.setDensity(10);
    colliderDesc.setFriction(0.7);
    colliderDesc.setRestitution(0.15);

    physicsWorld.createCollider(
        colliderDesc,
        body
    );

    dynamicBarrels.push({
        model: barrel,
        body: body,
        offset: modelOffset
    });
}
/* ===============================
   DECORACIÓN DEL NIVEL 1
   Cable industrial de prueba
================================ */

loader.load(
    "./assets/models/decoration/Prop_Cable_3.gltf",

    function (gltf) {

        cableModel = gltf.scene;

        const cable = cableModel.clone(true);

        cable.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Posición temporal para revisar el modelo
        cable.position.set(
            -8,
            0.08,
            -4.8
        );

        cable.rotation.y = Math.PI / 2;

        scene.add(cable);
        level1Decorations.push(cable);

        console.log(
            "Prop_Cable_3 cargado correctamente"
        );
    },

    undefined,

    function (error) {
        console.error(
            "Error cargando Prop_Cable_3:",
            error
        );
    }
);

/* ===============================
   DECORACIÓN DEL NIVEL 1
   Terminal de computadora de prueba
================================ */

loader.load(
    "./assets/models/decoration/Prop_Computer.gltf",

    function (gltf) {

        computerModel = gltf.scene;

        const computer = computerModel.clone(true);

        computer.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Posición temporal para revisar tamaño y orientación
        computer.position.set(
            13.5,
            0.1,
            -5
        );

        computer.rotation.y = -Math.PI / 2;

        scene.add(computer);
        level1Decorations.push(computer);
        const computer2 = computer.clone(true);

        computer2.position.set(
            -13.5,
            0.1,
            4
        );

        computer2.rotation.y = Math.PI / 2;

        scene.add(computer2);
        level1Decorations.push(computer2);

        console.log(
            "Prop_Computer cargado correctamente"
        );
    },

    undefined,

    function (error) {
        console.error(
            "Error cargando Prop_Computer:",
            error
        );
    }
);

/* ===============================
   DECORACIÓN DEL NIVEL 1
   Rejilla de ventilación industrial
================================ */

loader.load(
    "./assets/models/decoration/Prop_Vent_Big.gltf",

    function (gltf) {

        ventModel = gltf.scene;

        const vent = ventModel.clone(true);

        vent.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const ventPositions = [
            { x: 10.5, z: -8 },
            { x: -10.5, z: -8 },
            { x: 10.5, z: 7 }
        ];

        ventPositions.forEach((position) => {

            const ventClone = vent.clone(true);

            ventClone.position.set(
                position.x,
                0.08,
                position.z
            );

            scene.add(ventClone);
            level1Decorations.push(ventClone);
        });

        console.log(
            "Prop_Vent_Big cargado correctamente"
        );
    },

    undefined,

    function (error) {
        console.error(
            "Error cargando Prop_Vent_Big:",
            error
        );
    }
);

/* ===============================
   ANOMALÍA DE ENERGÍA - NIVEL 1
================================ */

loader.load(
    "./assets/models/anomaly/scene.gltf",

    (gltf) => {

        energyAnomaly = gltf.scene;

        energyAnomaly.position.set(
            0,
            1.2,
            3.2
        );

        scene.add(energyAnomaly);

        console.log(
            "MODELO DE ANOMALÍA CARGADO"
        );
    },

    undefined,

    (error) => {
        console.error(
            "Error cargando anomalía:",
            error
        );
    }
);

/* ===============================
   PERSONAJE R-0 - PRUEBA
================================ */

fbxLoader.load(
    "./assets/models/character/XBot.fbx",

    function (xbot) {

        r0 = xbot;

        xbot.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });
        xbot.scale.set(0.012, 0.012, 0.012);
        xbot.position.set(
            0,
            0.05,
            0
        );

        scene.add(xbot);

        if (physicsWorld) {

            const playerBodyDesc =
                RAPIER.RigidBodyDesc
                    .kinematicPositionBased()
                    .setTranslation(
                        xbot.position.x,
                        xbot.position.y,
                        xbot.position.z
                    );

            playerBody =
                physicsWorld.createRigidBody(
                    playerBodyDesc
                );

            const playerColliderDesc =
                RAPIER.ColliderDesc.capsule(
                    0.7,
                    0.45
                );

            playerCollider =
                physicsWorld.createCollider(
                    playerColliderDesc,
                    playerBody
                );

            characterController =
                physicsWorld.createCharacterController(
                    0.01
                );
            characterController.setApplyImpulsesToDynamicBodies(true);

            console.log(
                "Collider de R-0 creado correctamente"
            );
        }

        r0Mixer = new THREE.AnimationMixer(xbot);

        r0Mixer.addEventListener(
            "finished",
            (event) => {

                if (event.action === r0Actions.attack) {

                    isR0Attacking = false;

                    if (
                        r0Keys.w ||
                        r0Keys.a ||
                        r0Keys.s ||
                        r0Keys.d
                    ) {
                        playR0Action(
                            r0Keys.shift
                                ? "run"
                                : "walk"
                        );
                    } else {
                        playR0Action("idle");
                    }
                }

            }
        );

        console.log(
            "R-0 cargado correctamente"
        );

        fbxLoader.load(
            "./assets/models/character/Idle.fbx",

            function (idle) {

                if (idle.animations.length > 0) {

                    r0Actions.idle =
                        r0Mixer.clipAction(
                            idle.animations[0]
                        );

                    r0Actions.idle.play();
                    currentR0Action = r0Actions.idle;

                    console.log(
                        "Animación Idle cargada correctamente"
                    );
                }

                fbxLoader.load(
                    "./assets/models/character/Walk.fbx",

                    function (walk) {

                        if (walk.animations.length > 0) {

                            r0Actions.walk =
                                r0Mixer.clipAction(
                                    walk.animations[0]
                                );

                            r0Actions.walk.stop();

                            console.log(
                                "Animación Walk cargada correctamente"
                            );
                        }

                        fbxLoader.load(
                            "./assets/models/character/Run.fbx",

                            function (run) {

                                if (run.animations.length > 0) {

                                    r0Actions.run =
                                        r0Mixer.clipAction(
                                            run.animations[0]
                                        );

                                    r0Actions.run.stop();

                                    console.log(
                                        "Animación Run cargada correctamente"
                                    );
                                }

                                fbxLoader.load(
                                    "./assets/models/character/Attack.fbx",

                                    function (attack) {

                                        if (attack.animations.length > 0) {

                                            r0Actions.attack =
                                                r0Mixer.clipAction(
                                                    attack.animations[0]
                                                );

                                            r0Actions.attack.setLoop(
                                                THREE.LoopOnce
                                            );

                                            r0Actions.attack.clampWhenFinished = true;
                                            r0Actions.attack.stop();

                                            console.log(
                                                "Animación Attack cargada correctamente"
                                            );
                                        }

                                    },

                                    undefined,

                                    function (error) {

                                        console.error(
                                            "Error cargando animación Attack:",
                                            error
                                        );

                                    }
                                );

                            },

                            undefined,

                            function (error) {

                                console.error(
                                    "Error cargando animación Run:",
                                    error
                                );

                            }
                        );

                    },

                    undefined,

                    function (error) {

                        console.error(
                            "Error cargando animación Walk:",
                            error
                        );

                    }
                );

            },

            undefined,

            function (error) {

                console.error(
                    "Error cargando animación Idle:",
                    error
                );

            }
        );

    },

    undefined,

    function (error) {

        console.error(
            "Error cargando R-0:",
            error
        );

    }
);

let level2AssetsPromise = null;
let level3AssetsPromise = null;

function ensureLevel2AssetsLoaded() {

    if (!level2AssetsPromise) {
        level2AssetsPromise = Promise.all([
            loadGltfResource("assets/models/cores/scene.gltf")
                .then((gltf) => {
                    unstableCoreModel = gltf.scene;
                    console.log(
                        "Modelo del núcleo cargado correctamente"
                    );
                }),
            loadGltfResource("assets/models/lab/scene.gltf")
                .then((gltf) => {
                    labModel = gltf.scene;
                    console.log(
                        "Modelo de laboratorio cargado correctamente"
                    );
                }),
            audioSystem.loadLevelAudio(2)
        ]);
    }

    return level2AssetsPromise.catch((error) => {
        level2AssetsPromise = null;
        throw error;
    });
}

function ensureLevel3AssetsLoaded() {

    if (!level3AssetsPromise) {
        level3AssetsPromise = Promise.all([
            loadGltfResource("assets/models/reactor/scene.gltf")
                .then((gltf) => {
                    reactorModel = gltf.scene;
                    console.log(
                        "Modelo del reactor cargado correctamente"
                    );
                }),
            loadGltfResource("assets/models/soporte/scene.gltf")
                .then((gltf) => {
                    reactorSupportModel = gltf.scene;
                    console.log(
                        "Modelo del soporte del reactor cargado correctamente"
                    );
                }),
            loadGltfResource("assets/models/control-panel/scene.gltf")
                .then((gltf) => {
                    controlPanelModel = gltf.scene;
                    console.log(
                        "Modelo del panel de control cargado correctamente"
                    );
                }),
            loadGltfResource("assets/models/spind/scene.gltf")
                .then((gltf) => {
                    spindModel = gltf.scene;
                    console.log(
                        "Modelo Spind cargado correctamente"
                    );
                }),
            loadGltfResource("assets/models/environment/level3/scene.gltf")
                .then((gltf) => {
                    level3ExitModelOriginal = gltf.scene;
                    console.log(
                        "Modelo EXIT del Nivel 3 cargado correctamente"
                    );
                }),
            audioSystem.loadLevelAudio(3)
        ]);
    }

    return level3AssetsPromise.catch((error) => {
        level3AssetsPromise = null;
        throw error;
    });
}

/* ===============================
   CONTROLES DE CÁMARA
================================ */

const controls = new OrbitControls(
    camera,
    renderer.domElement
);

// Permitir control con mouse
controls.enabled = true;

// Movimiento suave
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// No permitir desplazar el punto de enfoque
controls.enablePan = false;

// Permitir zoom controlado
controls.enableZoom = true;

controls.minDistance = 3;
controls.maxDistance = 9;

// Evitar que la cámara pase por debajo del suelo
controls.minPolarAngle = Math.PI * 0.15;

// Evitar vista completamente vertical
controls.maxPolarAngle = Math.PI * 0.48;

controls.target.set(
    0,
    1.5,
    0
);

const registerManualCameraInput = () => {
    lastManualCameraInputTime =
        performance.now();
};

renderer.domElement.addEventListener(
    "pointerdown",
    registerManualCameraInput
);

renderer.domElement.addEventListener(
    "wheel",
    registerManualCameraInput,
    { passive: true }
);

renderer.domElement.addEventListener(
    "touchstart",
    registerManualCameraInput,
    { passive: true }
);
/* ===============================
   BOTÓN INICIAR
================================ */

const startButton =
    document.getElementById(
        "start-button"
    );

const terminalReady =
    document.querySelector(
        ".terminal-ready"
    );

// Bloquear inicio mientras cargan los recursos
startButton.disabled = true;

startButton.innerHTML =
    "<span>&#8987;</span> CARGANDO SISTEMAS...";

terminalReady.innerHTML =
    "<span></span> INICIALIZANDO REACTOR ZERO";

// Habilitar inicio cuando todos los recursos estén listos
loadingManager.onLoad = () => {

    console.log(
        "Todos los recursos del juego han terminado de cargar"
    );

    startButton.disabled = false;

    startButton.innerHTML =
        "<span>&#9654;</span> INICIAR PROTOCOLO";

    terminalReady.innerHTML =
        "<span></span> SISTEMA LISTO // ESPERANDO OPERADOR";
};

startButton.addEventListener(
    "click",
    () => {

        audioSystem.unlock();
        playButtonSound();
        audioSystem.playLevelMusic(1);

        document
            .getElementById(
                "start-screen"
            )
            .classList
            .add("hidden");

        document
            .getElementById(
                "hud"
            )
            .classList
            .remove("hidden");

        // ===============================
        // INICIO NORMAL DEL JUEGO
        // ===============================
        updateLevel1ObjectiveHud();

        configureLevelIntro(
            "FACILITY // SECTOR 01",
            "FÁBRICA",
            "RESTAURACIÓN DE ENERGÍA",
            "Reactiva los 3 generadores auxiliares para recuperar el suministro del sector.",
            "0 / 3"
        );

        showLevelIntro(() => {
            startLevelTimer();
        });

    }
);
const energyDisplay =
    document.getElementById("energy");
const energyUnitDisplay =
    document.getElementById("energy-unit");
const energyLabelDisplay =
    document.querySelector(
        ".hud-energy-info .hud-label"
    );
const energyFill =
    document.querySelector(".energy-fill");
const timerDisplay =
    document.getElementById("timer");
const scoreDisplay =
    document.getElementById("score");

updateEnergyHud();
updateScoreHud();
const minutes =
    Math.floor(levelTimeRemaining / 60);

const seconds =
    levelTimeRemaining % 60;

timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

const gameOverScreen =
    document.getElementById("game-over");

const gameOverTitle =
    document.getElementById("game-over-title");

const gameOverMessage =
    document.getElementById("game-over-message");
const pauseButton =
    document.getElementById("pause-button");
const pauseOverlay =
    document.getElementById("pause-overlay");
const resumeButton =
    document.getElementById("resume-button");
const restartButton =
    document.getElementById("restart-button");
const pulsePowerSelect =
    document.getElementById("pulse-power-select");

if (pulsePowerSelect) {
    pulsePowerSelect.addEventListener(
        "change",
        () => {
            pulsePhysicsPowerMultiplier =
                PULSE_POWER_MULTIPLIERS[pulsePowerSelect.value] ||
                PULSE_POWER_MULTIPLIERS.normal;
        }
    );
}

function playButtonSound() {
    audioSystem.playButtonClick();
}

function clearActionLock(stopAudio = false) {

    if (actionLockReleaseTimeout !== null) {
        clearTimeout(actionLockReleaseTimeout);
        actionLockReleaseTimeout = null;
    }

    if (stopAudio && actionLockAudio) {
        audioSystem.stopSfxInstance(actionLockAudio);
    }

    actionLockAudio = null;
    isActionLocked = false;
}

function lockActionUntilAudioEnds(audio, fallbackDuration = 2500) {

    clearActionLock();
    isActionLocked = true;
    actionLockAudio = audio;
    r0Keys.w = false;
    r0Keys.a = false;
    r0Keys.s = false;
    r0Keys.d = false;
    r0Keys.shift = false;
    r0Keys.f = false;
    cancelPendingAttackPulse();
    if (r0) {
        playR0Action("idle");
    }

    const unlock = () => {
        clearActionLock();
    };

    if (audio) {
        audio.addEventListener(
            "ended",
            unlock,
            { once: true }
        );

        audio.addEventListener(
            "error",
            unlock,
            { once: true }
        );

        if (audio._playPromise && audio._playPromise.catch) {
            audio._playPromise.catch(unlock);
        } else {
            actionLockReleaseTimeout =
                setTimeout(
                    unlock,
                    fallbackDuration
                );
        }
    } else {
        actionLockReleaseTimeout =
            setTimeout(
                unlock,
                fallbackDuration
            );
    }
}

function updatePauseButtonVisibility() {

    const canPause =
        gameplayActive &&
        !gameOver &&
        !levelCompleted &&
        !isPaused;

    pauseButton
        .classList
        .toggle("hidden", !canPause);
}

function pauseGame() {

    if (
        isPaused ||
        !gameplayActive ||
        gameOver ||
        levelCompleted
    ) {
        return;
    }

    isPaused = true;
    r0Keys.w = false;
    r0Keys.a = false;
    r0Keys.s = false;
    r0Keys.d = false;
    r0Keys.shift = false;
    r0Keys.f = false;
    cancelPendingAttackPulse();
    isR0Attacking = false;
    if (r0) {
        playR0Action("idle");
    }
    hideInteractionPrompt();
    audioSystem.pauseGameplayAudio();
    audioSystem.pauseSfxInstance(actionLockAudio);
    pauseOverlay.classList.remove("hidden");
    updatePauseButtonVisibility();
}

function resumeGame() {

    if (!isPaused) {
        return;
    }

    isPaused = false;
    pauseOverlay.classList.add("hidden");
    audioSystem.resumeGameplayAudio();
    audioSystem.resumeSfxInstance(actionLockAudio);
    updatePauseButtonVisibility();
}

function triggerGameOverAudio() {
    clearActionLock(true);
    audioSystem.playGameOver();
    updatePauseButtonVisibility();
}

restartButton.addEventListener(
    "click",
    () => {
        playButtonSound();
        window.location.reload();
    }
);

pauseButton.addEventListener(
    "click",
    () => {
        playButtonSound();
        pauseGame();
    }
);

resumeButton.addEventListener(
    "click",
    () => {
        playButtonSound();
        resumeGame();
    }
);


const nextLevelButton =
    document.getElementById("next-level-button");

nextLevelButton.addEventListener(
    "click",
    async () => {

        playButtonSound();

        try {
            if (currentLevel === 1) {
                await loadLevel2();
            } else if (currentLevel === 2) {
                await loadLevel3();
            } else if (currentLevel === 3 && levelCompleted) {
                window.location.reload();
            }
        } catch (error) {
            console.error(
                "No se pudo preparar el siguiente nivel:",
                error
            );
            nextLevelButton.disabled = false;
            if (currentLevel === 1) {
                nextLevelButton.innerHTML =
                    "<span>&#9654;</span> ACCEDER AL LABORATORIO";
            } else if (currentLevel === 2) {
                nextLevelButton.innerHTML =
                    "<span>&#9654;</span> ACCEDER A REACTOR ZERO";
            }
        }

    }
);

function setNextLevelLoading(isLoading, label) {

    nextLevelButton.disabled = isLoading;

    if (isLoading) {
        nextLevelButton.innerHTML =
            `<span>&#8987;</span> ${label}`;
    }
}

function formatTimer(secondsRemaining) {

    const minutes =
        Math.floor(secondsRemaining / 60);

    const seconds =
        secondsRemaining % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateEnergyHud() {

    if (currentLevel === 2) {
        const availablePulses =
            Math.floor(
                r0Energy / ENERGY_COST_PER_CORE_PULSE
            );

        const maxPulses =
            Math.floor(
                100 / ENERGY_COST_PER_CORE_PULSE
            );

        energyLabelDisplay.textContent =
            "PULSOS DISPONIBLES";
        energyDisplay.textContent =
            `${availablePulses} / ${maxPulses}`;
        energyUnitDisplay.textContent = "";
    } else {
        energyLabelDisplay.textContent =
            "NÚCLEO DE ENERGÍA";
        energyDisplay.textContent = r0Energy;
        energyUnitDisplay.textContent = "%";
    }

    energyFill.style.width =
        `${r0Energy}%`;
}

function updateScoreHud() {

    scoreDisplay.textContent = score;
}

function addScore(points, message = "") {

    score += points;
    updateScoreHud();

    if (message) {
        showMissionNotification(message);
    }
}

function subtractScore(points, message = "") {

    score =
        Math.max(
            0,
            score - points
        );

    updateScoreHud();

    if (message) {
        showMissionNotification(message);
    }
}

function updateTimerHud() {

    timerDisplay.textContent =
        formatTimer(levelTimeRemaining);
}

function startLevelTimer() {

    levelTimerRunning = true;
    timerAccumulator = 0;
    updateTimerHud();

    showMissionNotification(
        `CRONÓMETRO INICIADO // ${formatTimer(levelTimeRemaining)}`
    );
}

function configureLevelIntro(
    sector,
    title,
    mission,
    description,
    objective,
    extraLines = []
) {

    const levelIntro =
        document.getElementById("level-intro");

    levelIntro.querySelector(".intro-sector").textContent =
        sector;

    levelIntro.querySelector("h2").textContent =
        title;

    levelIntro.querySelector(".intro-mission").textContent =
        mission;

    levelIntro.querySelector("p").innerHTML =
        [
            description,
            ...extraLines
        ].join("<br>");

    levelIntro.querySelector(".intro-objective").innerHTML =
        `OBJECTIVE // <strong>${objective}</strong>`;
}

function showLevelIntro(onComplete) {

    gameplayActive = false;
    levelTimerRunning = false;
    cancelPendingAttackPulse();
    hideInteractionPrompt();

    const levelIntro =
        document.getElementById("level-intro");

    levelIntro.classList.remove("hidden");

    setTimeout(() => {

        levelIntro.classList.add("hidden");
        gameplayActive = true;

        if (onComplete) {
            onComplete();
        }

        updatePauseButtonVisibility();

    }, 3000);
}

function resetLevelState() {

    cancelPendingAttackPulse();

    levelCompleted = false;
    gameOver = false;
    isPaused = false;
    clearActionLock(true);
    gameplayActive = false;
    levelTimerRunning = false;
    timerAccumulator = 0;
    levelTimeRemaining = LEVEL_TIME_LIMIT;
    r0Energy = 100;
    lastAnomalyDamageTime = 0;
    isR0Attacking = false;

    updateEnergyHud();
    updateTimerHud();

    gameOverScreen
        .classList
        .add("hidden");

    pauseOverlay
        .classList
        .add("hidden");

    updatePauseButtonVisibility();

    document
        .getElementById("level-complete")
        .classList
        .add("hidden");

    interactionPrompt
        .classList
        .add("hidden");

    systemNotification
        .classList
        .add("hidden");
}

function moveR0ToStart(
    position,
    cameraPosition = null
) {

    if (playerBody) {
        playerBody.setNextKinematicTranslation(position);
        playerBody.setTranslation(position, true);
    }

    if (r0) {
        r0.position.set(
            position.x,
            position.y,
            position.z
        );

        r0.rotation.y = 0;
    }

    controls.target.set(
        position.x,
        position.y + 1.5,
        position.z
    );

    if (cameraPosition) {
        camera.position.set(
            cameraPosition.x,
            cameraPosition.y,
            cameraPosition.z
        );
    }
}

function clearActivePulses() {

    for (let i = energyPulses.length - 1; i >= 0; i--) {
        removeEnergyPulse(i);
    }
}

function clearDynamicProps() {

    dynamicCrates.forEach((crate) => {

        if (crate.body) {

            physicsWorld.removeRigidBody(
                crate.body
            );

            crate.body = null;
        }

        scene.remove(crate.model);
    });

    dynamicCrates.length = 0;
    usedCratePositions.length = 0;


    dynamicBarrels.forEach((barrel) => {

        if (barrel.body) {

            physicsWorld.removeRigidBody(
                barrel.body
            );

            barrel.body = null;
        }

        scene.remove(barrel.model);
    });

    dynamicBarrels.length = 0;

    console.log(
        "Props dinámicos anteriores eliminados"
    );
}

function cancelPendingAttackPulse() {

    if (pendingAttackPulseTimeout !== null) {
        clearTimeout(pendingAttackPulseTimeout);
        pendingAttackPulseTimeout = null;
    }
}

function clearMissionNotification() {

    if (missionNotificationTimeout !== null) {
        clearTimeout(missionNotificationTimeout);
        missionNotificationTimeout = null;
    }

    systemNotification
        .classList
        .add("hidden");
}

function scheduleAttackPulse() {

    cancelPendingAttackPulse();

    pendingAttackPulseTimeout = setTimeout(() => {

        pendingAttackPulseTimeout = null;

        if (
            !levelCompleted &&
            !gameOver &&
            gameplayActive &&
            r0
        ) {
            createEnergyPulse();
        }

    }, 2000);
}

function setHudObjective(title, hint = "") {

    currentObjectiveDisplay.textContent = title;
    objectiveHintDisplay.textContent = hint;
}

function showMissionNotification(message) {

    if (missionNotificationTimeout !== null) {
        clearTimeout(missionNotificationTimeout);
        missionNotificationTimeout = null;
    }

    notificationMessage.textContent = message;

    systemNotification
        .classList
        .remove("hidden");

    missionNotificationTimeout = setTimeout(() => {

        systemNotification
            .classList
            .add("hidden");

        missionNotificationTimeout = null;

    }, 2600);
}

function setInteractionPrompt(key, label, message) {

    interactionPromptKey.textContent = key;
    interactionPromptLabel.textContent = label;
    interactionPromptMessage.textContent = message;

    interactionPrompt
        .classList
        .remove("hidden");
}

function hideInteractionPrompt() {

    interactionPrompt
        .classList
        .add("hidden");
}

function clearObjectiveMarker() {

    if (!objectiveMarker) {
        return;
    }

    scene.remove(objectiveMarker);
    disposeObject3D(objectiveMarker);

    objectiveMarker = null;
    objectiveMarkerTarget = null;
    objectiveMarkerLabel = "";
}

function createMarkerLabelSprite(text) {

    const canvas =
        document.createElement("canvas");

    canvas.width = 384;
    canvas.height = 96;

    const context =
        canvas.getContext("2d");

    context.fillStyle = "rgba(3, 12, 14, 0.82)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#d89a43";
    context.lineWidth = 4;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.fillStyle = "#e9faff";
    context.font = "bold 34px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture =
        new THREE.CanvasTexture(canvas);

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            toneMapped: false
        });

    const sprite =
        new THREE.Sprite(material);

    sprite.scale.set(
        2.25,
        0.56,
        1
    );

    sprite.position.y = 1.05;

    return sprite;
}

function updateMarkerLabel(text) {

    if (
        !objectiveMarker ||
        objectiveMarkerLabel === text
    ) {
        return;
    }

    const oldLabel =
        objectiveMarker.userData.labelSprite;

    if (oldLabel) {
        objectiveMarker.remove(oldLabel);
        disposeObject3D(oldLabel);
    }

    const labelSprite =
        createMarkerLabelSprite(text);

    objectiveMarker.add(labelSprite);
    objectiveMarker.userData.labelSprite =
        labelSprite;
    objectiveMarkerLabel = text;
}

function createObjectiveMarker() {

    const markerGroup =
        new THREE.Group();

    const beam =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.018,
                0.018,
                1.05,
                6
            ),
            new THREE.MeshBasicMaterial({
                color: 0x7df4ff,
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
                toneMapped: false
            })
        );

    beam.position.y = 0.45;

    const diamond =
        new THREE.Mesh(
            new THREE.OctahedronGeometry(
                0.22,
                0
            ),
            new THREE.MeshBasicMaterial({
                color: 0x00d9ff,
                transparent: true,
                opacity: 0.82,
                depthWrite: false,
                toneMapped: false
            })
        );

    diamond.position.y = 1.02;

    const chevron =
        new THREE.Mesh(
            new THREE.ConeGeometry(
                0.34,
                0.34,
                4
            ),
            new THREE.MeshBasicMaterial({
                color: 0xffd36a,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                toneMapped: false
            })
        );

    chevron.position.y = 1.42;
    chevron.rotation.y = Math.PI / 4;
    chevron.rotation.x = Math.PI;

    const light =
        new THREE.PointLight(
            0x00d9ff,
            0.75,
            3.5
        );

    light.position.y = 1.0;

    markerGroup.add(beam);
    markerGroup.add(diamond);
    markerGroup.add(chevron);
    markerGroup.add(light);

    markerGroup.userData.beam = beam;
    markerGroup.userData.diamond = diamond;
    markerGroup.userData.chevron = chevron;

    scene.add(markerGroup);

    return markerGroup;
}

function createSupportLabelSprite(
    text,
    yPosition = 3.05
) {

    const canvas =
        document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 96;

    const context =
        canvas.getContext("2d");

    context.fillStyle = "rgba(0, 16, 22, 0.72)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#00e5ff";
    context.lineWidth = 4;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.fillStyle = "#dffcff";
    context.font = "bold 34px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture =
        new THREE.CanvasTexture(canvas);

    const sprite =
        new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                toneMapped: false
            })
        );

    sprite.scale.set(
        2.6,
        0.5,
        1
    );

    sprite.position.y = yPosition;

    return sprite;
}

function setObjectiveMarker(target, label = "") {

    if (!target) {
        clearObjectiveMarker();
        return;
    }

    if (!objectiveMarker) {
        objectiveMarker = createObjectiveMarker();
    }

    objectiveMarkerTarget = target;
    updateMarkerLabel(label);
}

function updateObjectiveMarker(delta) {

    if (
        !objectiveMarker ||
        !objectiveMarkerTarget
    ) {
        return;
    }

    objectiveMarker.position.copy(
        objectiveMarkerTarget.position
    );

    objectiveMarker.position.y += 2.15;

    const pulse =
        1 + Math.sin(performance.now() * 0.006) * 0.08;

    objectiveMarker.scale.set(
        pulse,
        pulse,
        pulse
    );

    if (objectiveMarker.userData.diamond) {
        objectiveMarker.userData.diamond.rotation.y +=
            1.9 * delta;
    }

    if (objectiveMarker.userData.chevron) {
        objectiveMarker.userData.chevron.position.y =
            1.42 +
            Math.sin(performance.now() * 0.005) * 0.08;
    }
}

function updateCameraCollision() {

    if (
        !r0 ||
        cameraObstacleMeshes.length === 0
    ) {
        return;
    }

    cameraRayDirection
        .copy(camera.position)
        .sub(controls.target);

    const desiredDistance =
        cameraRayDirection.length();

    if (desiredDistance <= 0.001) {
        return;
    }

    cameraRayDirection.normalize();

    cameraRaycaster.set(
        controls.target,
        cameraRayDirection
    );

    cameraRaycaster.near = 0.05;
    cameraRaycaster.far = desiredDistance;

    const intersections =
        cameraRaycaster.intersectObjects(
            cameraObstacleMeshes,
            false
        );

    if (intersections.length === 0) {
        cameraOcclusionFocus.set(
            r0.position.x,
            r0.position.y + 1.2,
            r0.position.z
        );

        cameraOcclusionDirection
            .copy(camera.position)
            .sub(cameraOcclusionFocus);

        const occlusionDistance =
            cameraOcclusionDirection.length();

        if (occlusionDistance <= 0.001) {
            return;
        }

        cameraOcclusionDirection.normalize();

        cameraRaycaster.set(
            cameraOcclusionFocus,
            cameraOcclusionDirection
        );

        cameraRaycaster.near = 0.05;
        cameraRaycaster.far = occlusionDistance;

        const occlusionHits =
            cameraRaycaster.intersectObjects(
                cameraObstacleMeshes,
                false
            );

        if (occlusionHits.length === 0) {
            return;
        }

        const occlusionSafeDistance =
            Math.max(
                occlusionHits[0].distance - cameraOcclusionMargin,
                1.15
            );

        camera.position.lerp(
            cameraOcclusionSafePosition
                .copy(cameraOcclusionFocus)
                .addScaledVector(
                    cameraOcclusionDirection,
                    occlusionSafeDistance
                ),
            0.55
        );

        return;
    }

    const hitDistance =
        intersections[0].distance;

    const safeDistance =
        Math.max(
            hitDistance - cameraCollisionMargin,
            0.85
        );

    camera.position
        .copy(controls.target)
        .addScaledVector(
            cameraRayDirection,
            safeDistance
        );
}

function updateLevel1ObjectiveHud() {

    if (currentLevel !== 1) {
        return;
    }

    document.getElementById("level").textContent = "1";
    document.getElementById("objectives").textContent =
        `${activatedGenerators} / 3`;

    if (activatedGenerators === 0) {
        setHudObjective(
            "ACTIVA GENERATOR 01",
            "USA [E] INTERACTUAR"
        );
        setObjectiveMarker(
            generators[0],
            "GENERATOR 01"
        );
        return;
    }

    if (activatedGenerators === 1) {
        setHudObjective(
            "ACTIVA GENERATOR 02",
            "USA [E] INTERACTUAR"
        );
        setObjectiveMarker(
            generators[1],
            "GENERATOR 02"
        );
        return;
    }

    if (
        activatedGenerators === 2 &&
        energyAnomaly
    ) {
        setHudObjective(
            "DESTRUYE LA ANOMALÍA",
            "USA [F] PULSO DE ENERGÍA"
        );
        setObjectiveMarker(
            energyAnomaly,
            "ANOMALÍA"
        );
        return;
    }

    if (activatedGenerators === 2) {
        setHudObjective(
            "ACTIVA GENERATOR 03",
            "USA [E] INTERACTUAR"
        );
        setObjectiveMarker(
            generators[2],
            "GENERATOR 03"
        );
        return;
    }

    clearObjectiveMarker();
}

function clearLevelMissionObjects() {

    cancelPendingAttackPulse();
    clearMissionNotification();
    clearObjectiveMarker();

    generators.forEach((generator) => {

        generator.visible = false;
        generator.userData.activated = true;
        generator.userData.blocked = true;

        if (generator.userData.body) {
            physicsWorld.removeRigidBody(
                generator.userData.body
            );
            generator.userData.body = null;
        }

    });

    if (energyAnomaly) {
        scene.remove(energyAnomaly);
        energyAnomaly = null;
    }

    for (let i = unstableCores.length - 1; i >= 0; i--) {
        removeUnstableCore(i);
    }


    clearLevel3Objects();
}

function disposeObject3D(object) {

    object.traverse((child) => {

        if (child.geometry) {
            child.geometry.dispose();
        }

        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((material) => {
                    if (material.map) {
                        material.map.dispose();
                    }
                    material.dispose();
                });
            } else {
                if (child.material.map) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }
        }

    });
}

function createFixedBoxColliderFromObject(
    object,
    scale = {
        x: 0.46,
        y: 0.46,
        z: 0.46
    }
) {

    object.updateMatrixWorld(true);

    const box =
        new THREE.Box3().setFromObject(object);

    const size =
        new THREE.Vector3();

    const center =
        new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const body =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    center.x,
                    center.y,
                    center.z
                )
        );

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            size.x * scale.x,
            size.y * scale.y,
            size.z * scale.z
        ),
        body
    );

    object.userData.body = body;

    return body;
}

function removeRigidBodyFromObject(object) {

    if (!object || !object.userData.body) {
        return;
    }

    physicsWorld.removeRigidBody(
        object.userData.body
    );

    object.userData.body = null;
}

function createUnstableCore(position, index) {

    const coreGroup = new THREE.Group();

    let coreMesh;

    if (unstableCoreModel) {

        coreMesh = unstableCoreModel.clone(true);

        coreMesh.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

    } else {

        // Modelo provisional por si el GLTF todavía no ha cargado
        const fallbackGeometry =
            new THREE.IcosahedronGeometry(
                0.55,
                1
            );

        const fallbackMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x00d9ff,
                emissive: 0x0066ff,
                emissiveIntensity: 1.8
            });

        coreMesh =
            new THREE.Mesh(
                fallbackGeometry,
                fallbackMaterial
            );
    }



    const coreLight =
        new THREE.PointLight(
            0x00d9ff,
            1.5,
            5
        );

    coreGroup.add(coreMesh);
    coreGroup.add(coreLight);

    coreGroup.position.set(
        position.x,
        position.y,
        position.z
    );

    coreGroup.name =
        `Unstable_Core_${index + 1}`;

    coreGroup.userData.health = 3;
    coreGroup.userData.destroyed = false;
    coreGroup.userData.coreMesh = coreMesh;

    scene.add(coreGroup);
    // ===============================
    // COLLIDER DEL NÚCLEO INESTABLE
    // ===============================

    coreGroup.updateMatrixWorld(true);

    const coreBox =
        new THREE.Box3().setFromObject(coreGroup);

    const coreCenter =
        new THREE.Vector3();

    const coreSize =
        new THREE.Vector3();

    coreBox.getCenter(coreCenter);
    coreBox.getSize(coreSize);

    const coreBody =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    coreCenter.x,
                    coreCenter.y,
                    coreCenter.z
                )
        );

    const CORE_COLLIDER_MARGIN = 0.35;

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            coreSize.x / 2 + CORE_COLLIDER_MARGIN,
            coreSize.y / 2,
            coreSize.z / 2 + CORE_COLLIDER_MARGIN
        ),
        coreBody
    );

    coreGroup.userData.body = coreBody;

    unstableCores.push(coreGroup);
}

function createLevel2Cores() {

    destroyedUnstableCores = 0;

    const corePositions = [
        // Núcleo 01 — primera zona al entrar
        { x: -4.5, y: 1.05, z: -5.5 },

        // Núcleo 02 — lateral izquierdo
        { x: -10.5, y: 1.05, z: 0 },

        // Núcleo 03 — lateral derecho
        { x: 10.5, y: 1.05, z: -1 },

        // Núcleo 04 — zona posterior izquierda
        { x: -8.5, y: 1.05, z: 6 },

        // Núcleo 05 — zona posterior derecha
        { x: 8.5, y: 1.05, z: 6 }
    ];

    corePositions.forEach((position, index) => {
        createUnstableCore(position, index);
    });
}

function createLevel2DynamicProps() {

    if (!dynamicCrateOriginal || !dynamicBarrelOriginal) {
        console.warn(
            "Props dinámicos del Nivel 2 pendientes: modelos aún no cargados"
        );
        return;
    }

    const level2Crates = [
        { x: -7.2, y: 1.2, z: -5.4 },
        { x: -3.1, y: 1.2, z: -7.4 },
        { x: -12.4, y: 1.2, z: -2.5 },
        { x: -12.2, y: 1.2, z: 2.7 },
        { x: 7.2, y: 1.2, z: -3.7 },
        { x: 12.2, y: 1.2, z: -3.4 },
        { x: -6.1, y: 1.2, z: 5.1 },
        { x: -10.9, y: 1.2, z: 7.7 },
        { x: 6.0, y: 1.2, z: 4.7 },
        { x: 10.8, y: 1.2, z: 7.7 }
    ];

    const level2Barrels = [
        { x: -2.2, y: 0.15, z: -4.1 },
        { x: -8.0, y: 0.15, z: -0.3 },
        { x: 8.0, y: 0.15, z: 1.4 },
        { x: -9.9, y: 0.15, z: 4.0 },
        { x: 9.9, y: 0.15, z: 3.7 },
        { x: 2.2, y: 0.15, z: 6.8 }
    ];

    level2Crates.forEach((position) => {
        createDynamicCrate(
            dynamicCrateOriginal,
            position.x,
            position.y,
            position.z
        );
    });

    level2Barrels.forEach((position) => {
        createDynamicBarrel(
            dynamicBarrelOriginal,
            position.x,
            position.y,
            position.z
        );
    });

    console.log(
        "Distribución física del Nivel 2 creada correctamente"
    );
}

function removeUnstableCore(indexOrCore) {

    const core =
        typeof indexOrCore === "number"
            ? unstableCores[indexOrCore]
            : indexOrCore;

    if (!core) {
        return;
    }

    if (core.userData.removed) {
        return;
    }

    core.userData.removed = true;

    // Eliminar física del núcleo
    if (core.userData.body) {

        physicsWorld.removeRigidBody(
            core.userData.body
        );

        core.userData.body = null;
    }

    scene.remove(core);
    disposeObject3D(core);

    const coreIndex =
        unstableCores.indexOf(core);

    if (coreIndex !== -1) {
        unstableCores.splice(
            coreIndex,
            1
        );
    }
}

function updateLevel2Hud() {

    document.getElementById("level").textContent = "2";
    document.getElementById("objectives").textContent =
        `${destroyedUnstableCores} / 5`;
    setHudObjective(
        "DESTRUYE LOS NÚCLEOS INESTABLES",
        "USA [F] PULSO DE ENERGÍA"
    );
    updateLevel2ObjectiveMarker();
}

function getCoreDisplayName(core) {

    const coreNumber =
        Number(
            core.name.replace(
                "Unstable_Core_",
                ""
            )
        );

    return `UNSTABLE CORE ${String(coreNumber).padStart(2, "0")}`;
}

function getNearestActiveCore() {

    let nearestCore = null;
    let nearestDistance = Infinity;

    unstableCores.forEach((core) => {

        if (core.userData.destroyed) {
            return;
        }

        const distance =
            r0
                ? r0.position.distanceTo(core.position)
                : 0;

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCore = core;
        }

    });

    return nearestCore;
}

function updateLevel2ObjectiveMarker(forceRecharge = false) {

    if (currentLevel !== 2) {
        return;
    }

    if (
        level2RechargeStation &&
        (
            forceRecharge ||
            r0Energy <= ENERGY_COST_PER_CORE_PULSE * 2
        )
    ) {
        setObjectiveMarker(
            level2RechargeStation,
            "LAB // RECARGA"
        );
        return;
    }

    const nearestCore =
        getNearestActiveCore();

    if (nearestCore) {
        setObjectiveMarker(
            nearestCore,
            getCoreDisplayName(nearestCore)
        );
    } else {
        clearObjectiveMarker();
    }
}
function clearLevel1Decorations() {

    level1Decorations.forEach((object) => {
        scene.remove(object);
    });

    level1Decorations.length = 0;

    console.log(
        "Decoración del Nivel 1 eliminada"
    );
}
function createLevel2ResearchStations() {

    if (!computerModel ||
        !cableModel ||
        !ventModel ||
        !labModel) {
        console.warn(
            "Modelos de laboratorio aún no disponibles"
        );
        return;
    }

    // ===============================
    // ESTACIÓN 01 — DIAGNÓSTICO
    // ===============================

    const computer =
        computerModel.clone(true);

    computer.position.set(
        -4.5,
        0.1,
        -7.6
    );

    computer.rotation.y = 0;

    scene.add(computer);
    level2Decorations.push(computer);
    createFixedBoxColliderFromObject(computer);


    const cable =
        cableModel.clone(true);

    cable.position.set(
        -4.5,
        0.08,
        -6.5
    );
    cable.rotation.y = 0;

    cable.rotation.y =
        Math.PI / 2;

    scene.add(cable);
    level2Decorations.push(cable);


    // ===============================
    // ESTACIÓN 02 — ÁREA DE PRUEBAS
    // ===============================

    const computer2A =
        computerModel.clone(true);

    computer2A.position.set(
        -12.2,
        0.1,
        -1.2
    );

    computer2A.rotation.y =
        Math.PI / 2;

    scene.add(computer2A);
    level2Decorations.push(computer2A);
    createFixedBoxColliderFromObject(computer2A);


    const computer2B =
        computerModel.clone(true);

    computer2B.position.set(
        -12.2,
        0.1,
        1.2
    );

    computer2B.rotation.y =
        Math.PI / 2;

    scene.add(computer2B);
    level2Decorations.push(computer2B);
    createFixedBoxColliderFromObject(computer2B);


    // ===============================
    // ESTACIÓN 03 — ENERGÍA
    // ===============================

    const vent3 =
        ventModel.clone(true);

    vent3.position.set(
        12.5,
        0.08,
        -1
    );

    vent3.rotation.y =
        Math.PI / 2;

    scene.add(vent3);
    level2Decorations.push(vent3);


    const cable3 =
        cableModel.clone(true);

    cable3.position.set(
        11.5,
        0.08,
        -1
    );

    cable3.rotation.y =
        Math.PI / 2;

    scene.add(cable3);
    level2Decorations.push(cable3);



    // ===============================
    // ESTACIÓN 04 — ANÁLISIS
    // ===============================

    const computer4A =
        computerModel.clone(true);

    computer4A.position.set(
        -10.5,
        0.1,
        6.8
    );

    computer4A.rotation.y =
        Math.PI / 2;

    scene.add(computer4A);
    level2Decorations.push(computer4A);
    createFixedBoxColliderFromObject(computer4A);


    const computer4B =
        computerModel.clone(true);

    computer4B.position.set(
        -10.5,
        0.1,
        5.4
    );

    computer4B.rotation.y =
        Math.PI / 2;

    scene.add(computer4B);
    level2Decorations.push(computer4B);
    createFixedBoxColliderFromObject(computer4B);


    const cable4 =
        cableModel.clone(true);

    cable4.position.set(
        -9.5,
        0.08,
        6
    );

    cable4.rotation.y =
        Math.PI / 2;

    scene.add(cable4);
    level2Decorations.push(cable4);





    // ===============================
    // ESTACIÓN 05 — CONTENCIÓN
    // ===============================

    const vent5A =
        ventModel.clone(true);

    vent5A.position.set(
        5.8,
        0.08,
        7.2
    );

    vent5A.rotation.y = 0;

    scene.add(vent5A);
    level2Decorations.push(vent5A);





    const computer5 =
        computerModel.clone(true);

    computer5.position.set(
        8.5,
        0.1,
        3.8
    );

    computer5.rotation.y =
        Math.PI;

    scene.add(computer5);
    level2Decorations.push(computer5);
    createFixedBoxColliderFromObject(computer5);

    // ===============================
    // EQUIPO DE LABORATORIO
    // ===============================

    if (labModel) {

        const labTest = labModel.clone(true);

        labTest.traverse((child) => {

            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

        });


        // Posición definitiva
        labTest.position.set(
            0,
            0.1,
            -8
        );

        labTest.scale.set(
            8,
            8,
            8
        );

        labTest.rotation.y = 0;

        scene.add(labTest);


        // ===============================
        // COLLIDER
        // ===============================

        // 1. Primero calculamos el tamaño real
        const labBox =
            new THREE.Box3().setFromObject(labTest);

        const labSize =
            new THREE.Vector3();

        const labCenter =
            new THREE.Vector3();

        labBox.getSize(labSize);
        labBox.getCenter(labCenter);


        // 2. Después creamos el cuerpo físico
        const labBody =
            physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(
                        labCenter.x,
                        labCenter.y,
                        labCenter.z
                    )
            );


        // 3. Finalmente creamos el collider
        physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(
                labSize.x / 2,
                labSize.y / 2,
                labSize.z / 2
            ),
            labBody
        );


        // Guardamos el cuerpo para eliminarlo
        // cuando abandonemos el Nivel 2
        labTest.userData.body = labBody;
        level2RechargeStation = labTest;


        level2Decorations.push(labTest);

        console.log(
            "Equipo de laboratorio y collider creados correctamente"
        );
    }


}
function clearLevel2Decorations() {

    level2RechargeStation = null;

    level2Decorations.forEach((object) => {

        removeRigidBodyFromObject(object);

        // Eliminar objeto visual
        scene.remove(object);
    });

    level2Decorations.length = 0;

    console.log(
        "Decoración y colliders del Nivel 2 eliminados"
    );
}


function updateFinalAuthorCredit(visible) {

    const levelComplete =
        document.getElementById("level-complete");

    if (!levelComplete) {
        return;
    }

    let authorCredit =
        levelComplete.querySelector(".complete-author-credit");

    if (!authorCredit) {
        authorCredit =
            document.createElement("div");
        authorCredit.className =
            "complete-author-credit hidden";
        authorCredit.innerHTML =
            "<span>AUTOR</span><strong>MARICRUZ PINEDA LARA</strong>";

        const footer =
            levelComplete.querySelector(".complete-footer");
        const terminal =
            levelComplete.querySelector(".complete-terminal");

        if (footer && terminal) {
            terminal
                .insertBefore(
                    authorCredit,
                    footer
                );
        }
    }

    authorCredit
        .classList
        .toggle(
            "hidden",
            !visible
        );
}


function prepareLevel1CompleteScreen() {

    cancelPendingAttackPulse();
    clearObjectiveMarker();
    levelTimerRunning = false;
    gameplayActive = false;
    updatePauseButtonVisibility();

    const levelComplete =
        document.getElementById("level-complete");
    const recoveryRows =
        levelComplete.querySelectorAll(".recovery-row");

    recoveryRows.forEach((row) => {
        row.style.display = "";
    });

    levelComplete.querySelector(".complete-id").textContent =
        "FAC-01";
    levelComplete.querySelector(".complete-status").lastChild.textContent =
        " POWER GRID RESTORED";
    levelComplete.querySelector(".complete-header h2").innerHTML =
        "ENERGÍA <span>RESTAURADA</span>";
    levelComplete.querySelector(".complete-subtitle").textContent =
        "SYSTEM REPORT // LEVEL 01";
    levelComplete.querySelector(".recovery-title span:last-child").textContent =
        "03 / 03";
    levelComplete.querySelector(".complete-objective-number").innerHTML =
        "03 <small>/03</small>";
    levelComplete.querySelector(".complete-objective p").textContent =
        "Los generadores de la fábrica están operativos. El suministro energético del sector ha sido restaurado. Acceso al laboratorio habilitado.";
    levelComplete.querySelector(".complete-footer span:first-child").textContent =
        "LEVEL 01 // FACTORY";
    levelComplete.querySelector(".complete-footer span:last-child").textContent =
        "RECOVERY CONFIRMED";
    updateFinalAuthorCredit(false);

    const extraRow =
        levelComplete.querySelector(".recovery-extra");

    if (extraRow) {
        extraRow.style.display = "none";
    }
    nextLevelButton.innerHTML =
        "<span>&#9654;</span> ACCEDER AL LABORATORIO";
}

function showLevel2Complete() {

    cancelPendingAttackPulse();
    clearObjectiveMarker();
    levelTimerRunning = false;
    gameplayActive = false;

    levelCompleted = true;
    updatePauseButtonVisibility();

    const levelComplete =
        document.getElementById("level-complete");
    const recoveryRows =
        levelComplete.querySelectorAll(".recovery-row");

    recoveryRows.forEach((row) => {
        row.style.display = "";
    });

    levelComplete.querySelector(".complete-id").textContent =
        "LAB-02";
    levelComplete.querySelector(".complete-status").lastChild.textContent =
        " LABORATORY STABILIZED";
    levelComplete.querySelector(".complete-header h2").innerHTML =
        "LABORATORIO <span>ESTABILIZADO</span>";
    levelComplete.querySelector(".complete-subtitle").textContent =
        "SYSTEM REPORT // LEVEL 02";
    levelComplete.querySelector(".recovery-title span:last-child").textContent =
        "05 / 05";

    recoveryRows.forEach((row, index) => {

        const label =
            row.querySelector("span:first-child");

        const status =
            row.querySelector(".recovery-online");

        if (index < 5 && label) {
            label.textContent =
                `UNSTABLE CORE ${String(index + 1).padStart(2, "0")}`;
        }

        if (status) {
            status.lastChild.textContent =
                " STABILIZED";
        }

    });

    levelComplete.querySelector(".complete-objective-number").innerHTML =
        "05 <small>/05</small>";
    levelComplete.querySelector(".complete-objective p").textContent =
        "Los núcleos inestables del laboratorio han sido destruidos. El sector ha quedado estabilizado. Siguiente sector: REACTOR ZERO.";
    levelComplete.querySelector(".complete-footer span:first-child").textContent =
        "LEVEL 02 // LABORATORY";
    levelComplete.querySelector(".complete-footer span:last-child").textContent =
        "NEXT SECTOR // REACTOR ZERO";
    updateFinalAuthorCredit(false);
    nextLevelButton.innerHTML =
        "<span>&#9654;</span> ACCEDER A REACTOR ZERO";

    levelComplete
        .classList
        .remove("hidden");
}

async function loadLevel2() {

    console.log(
        "Iniciando Nivel 2 - Laboratorio"
    );

    setNextLevelLoading(
        true,
        "CARGANDO LABORATORIO..."
    );

    await ensureLevel2AssetsLoaded();

    currentLevel = 2;

    setLevel2Lighting();
    audioSystem.stopEvacAlarm();
    audioSystem.playLevelMusic(2);

    clearActivePulses();
    clearLevelMissionObjects();
    clearDynamicProps();
    resetLevelState();
    levelTimeRemaining = 180;
    updateTimerHud();
    clearLevel1IndustrialBackdrop();
    createLevel2IndustrialBackdrop();
    clearLevel1Decorations();
    createLevel2Cores();
    createLevel2DynamicProps();

    createLevel2ResearchStations();
    updateLevel2Hud();
    moveR0ToStart({
        x: 0,
        y: 0.05,
        z: 0
    });
    configureLevelIntro(
        "FACILITY // SECTOR 02",
        "LABORATORIO",
        "CONTENCIÓN DE ENERGÍA",
        "Destruye los 5 núcleos inestables para estabilizar el laboratorio.",
        "0 / 5",
        [
            "Cada pulso consume energía.",
            "Usa la estación LAB para recargar R-0."
        ]
    );
    showLevelIntro(() => {
        updateLevel2ObjectiveMarker(true);
        startLevelTimer();
    });

    nextLevelButton.disabled = false;
}

function createReactorSupport(position, index) {

    if (!reactorSupportModel) {
        console.warn(
            `Modelo del soporte ${index + 1} aún no disponible`
        );
        return;
    }

    const supportGroup = new THREE.Group();

    // =========================================
    // MODELO 3D DEL SOPORTE
    // =========================================

    const supportModel =
        reactorSupportModel.clone(true);

    supportModel.traverse((child) => {

        if (child.isMesh) {

            child.castShadow = true;
            child.receiveShadow = true;

        }

    });

    supportModel.scale.set(
        0.0007,
        0.0007,
        0.0007
    );

    supportModel.position.set(
        0,
        0,
        0
    );

    supportModel.rotation.y = 0;

    supportGroup.add(supportModel);


    // =========================================
    // LUZ DEL SOPORTE
    // =========================================

    const light =
        new THREE.PointLight(
            0x00e5ff,
            1.2,
            4
        );

    light.position.y = 1.8;

    supportGroup.add(light);


    // =========================================
    // POSICIÓN DEL SOPORTE
    // =========================================

    supportGroup.position.set(
        position.x,
        position.y,
        position.z
    );

    supportGroup.name =
        `Reactor_Support_${index + 1}`;

    supportGroup.updateMatrixWorld(true);

    const visualSupportBox =
        new THREE.Box3().setFromObject(
            supportModel
        );

    const supportLabelY =
        visualSupportBox.max.y -
        supportGroup.position.y +
        0.85;


    // =========================================
    // DATOS DE GAMEPLAY
    // =========================================

    supportGroup.userData.health = 3;
    supportGroup.userData.destroyed = false;

    // Conservamos una referencia visual
    // para efectos posteriores.
    supportGroup.userData.coreMesh = supportModel;

    const supportLabel =
        createSupportLabelSprite(
            `REACTOR SUPPORT ${String(index + 1).padStart(2, "0")}`,
            supportLabelY
        );

    supportGroup.add(supportLabel);
    supportGroup.userData.labelSprite =
        supportLabel;

    const start =
        new THREE.Vector3(
            position.x,
            1.4,
            position.z
        );

    const end =
        new THREE.Vector3(
            0,
            1.4,
            0
        );

    const direction =
        new THREE.Vector3()
            .subVectors(end, start);

    const distance =
        direction.length();

    const midpoint =
        new THREE.Vector3()
            .addVectors(start, end)
            .multiplyScalar(0.5);

    const geometry =
        new THREE.CylinderGeometry(
            0.045,
            0.045,
            distance,
            8
        );

    const material =
        new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.7,
            toneMapped: false
        });

    const energyBeam =
        new THREE.Mesh(
            geometry,
            material
        );

    energyBeam.position.copy(midpoint);

    energyBeam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
    );

    scene.add(energyBeam);

    supportGroup.userData.energyBeam =
        energyBeam;
    // =========================================
    // ESCENA
    // =========================================

    scene.add(supportGroup);

    reactorSupports.push(
        supportGroup
    );
    registerCameraObstacle(supportGroup);
    // =========================================
    // COLLIDER FÍSICO DEL SOPORTE
    // =========================================

    supportGroup.updateMatrixWorld(true);

    const supportBox =
        new THREE.Box3().setFromObject(
            supportGroup
        );

    const supportSize =
        new THREE.Vector3();

    const supportCenter =
        new THREE.Vector3();

    supportBox.getSize(
        supportSize
    );

    supportBox.getCenter(
        supportCenter
    );

    const supportBody =
        physicsWorld.createRigidBody(

            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    supportCenter.x,
                    supportCenter.y,
                    supportCenter.z
                )

        );

    // Collider cilíndrico para el cuerpo
    // principal del soporte.
    physicsWorld.createCollider(

        RAPIER.ColliderDesc.cylinder(
            supportSize.y * 0.45,
            1.15
        ),

        supportBody

    );

    // Guardamos el rigid body para eliminarlo
    // cuando el soporte sea destruido.
    supportGroup.userData.body =
        supportBody;

    console.log(
        `Collider creado para ${supportGroup.name}`
    );



}

function createReactorSupports() {

    destroyedReactorSupports = 0;

    const supportPositions = [
        { x: -8, y: 0.05, z: -5 },
        { x: 8, y: 0.05, z: -5 },
        { x: 0, y: 0.05, z: 4 }
    ];

    supportPositions.forEach((position, index) => {
        createReactorSupport(position, index);
    });
}

function updateLevel3Hud() {

    document.getElementById("level").textContent = "3";
    document.getElementById("objectives").textContent =
        `${destroyedReactorSupports} / 3`;
    setHudObjective(
        "DESTRUYE LOS SOPORTES DEL REACTOR",
        "USA [F] PULSO DE ENERGÍA"
    );
    clearObjectiveMarker();
}

function updateLevel3EscapeHud() {

    document.getElementById("level").textContent = "3";
    document.getElementById("objectives").textContent =
        "ESCAPA DEL REACTOR";
    setHudObjective(
        "⚠ EVACUACIÓN DE EMERGENCIA",
        "LLEGA A LA SALIDA"
    );
    timerDisplay.textContent =
        formatTimer(
            Math.ceil(level3EscapeTimeRemaining)
        );
}

function getLevel3ExitPosition() {

    if (doorFrameModel) {
        doorFrameModel.updateMatrixWorld(true);

        const doorBox =
            new THREE.Box3().setFromObject(doorFrameModel);

        const doorCenter =
            new THREE.Vector3();

        doorBox.getCenter(doorCenter);

        return {
            x: doorCenter.x,
            y: 0,
            z: doorCenter.z
        };
    }

    return {
        x: 2,
        y: 0,
        z: 9.74
    };
}

function createLevel3Exit() {

    const exitGroup =
        new THREE.Group();

    const markerMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.28,
            toneMapped: false,
            depthWrite: false
        });

    const marker =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3.0,
                0.08,
                1.45
            ),
            markerMaterial
        );

    marker.position.y = 0.08;

    const frameMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.7,
            toneMapped: false
        });

    const leftPost =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.08,
                2.0,
                0.08
            ),
            frameMaterial
        );

    leftPost.position.set(
        -1.35,
        1.05,
        0
    );

    const rightPost =
        leftPost.clone();

    rightPost.position.x = 1.35;

    const topBar =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.8,
                0.08,
                0.08
            ),
            frameMaterial
        );

    topBar.position.y = 2.0;

    const light =
        new THREE.PointLight(
            0x00ffcc,
            2.2,
            8
        );

    light.position.y = 1.2;

    exitGroup.add(marker);
    exitGroup.add(leftPost);
    exitGroup.add(rightPost);
    exitGroup.add(topBar);
    exitGroup.add(light);

    const exitPosition =
        getLevel3ExitPosition();

    exitGroup.position.set(
        exitPosition.x,
        exitPosition.y,
        exitPosition.z
    );

    if (level3ExitModelOriginal) {

        const exitModel =
            level3ExitModelOriginal.clone(true);

        exitModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = false;
                child.receiveShadow = true;
            }
        });

        exitModel.rotation.y = Math.PI / 2;
        exitGroup.add(exitModel);
        exitModel.updateMatrixWorld(true);

        const initialBox =
            new THREE.Box3().setFromObject(exitModel);
        const initialSize =
            new THREE.Vector3();

        initialBox.getSize(initialSize);

        const largestFootprint =
            Math.max(
                initialSize.x,
                initialSize.z,
                0.001
            );

        const exitScale =
            2.8 / largestFootprint;

        exitModel.scale.setScalar(exitScale);
        exitModel.updateMatrixWorld(true);

        const scaledBox =
            new THREE.Box3().setFromObject(exitModel);
        const scaledCenter =
            new THREE.Vector3();
        const scaledSize =
            new THREE.Vector3();

        scaledBox.getCenter(scaledCenter);
        scaledBox.getSize(scaledSize);

        const exitVisualLift =
            Math.max(
                scaledSize.y * 0.9,
                3.0
            );

        exitModel.position.x -= scaledCenter.x;
        exitModel.position.z -= scaledCenter.z;
        exitModel.position.y +=
            exitVisualLift - scaledBox.min.y;
        // Adelantar visualmente el cartel EXIT
        exitModel.position.z -= 0.6;

        exitGroup.userData.exitModel =
            exitModel;
    }

    exitGroup.visible = false;
    exitGroup.userData.halfWidth = 1.35;
    exitGroup.userData.halfDepth = 0.75;
    exitGroup.userData.marker = marker;
    exitGroup.userData.light = light;
    exitGroup.userData.sign = null;

    scene.add(exitGroup);
    level3ExitZone = exitGroup;
}

function startLevel3Escape() {

    level3EscapeActive = true;
    level3EscapeTimeRemaining =
        LEVEL3_ESCAPE_TIME;
    audioSystem.startEvacAlarm();

    if (!level3ExitZone) {
        createLevel3Exit();
    }

    level3ExitZone.visible = true;
    setLevel3EmergencyLighting();
    clearObjectiveMarker();
    updateLevel3EscapeHud();

    showMissionNotification(
        "FALLO CRÍTICO // REACTOR INESTABLE // EVACÚA"
    );
}

function checkLevel3Exit() {

    if (
        !level3EscapeActive ||
        !level3ExitZone ||
        !r0
    ) {
        return;
    }

    const exitPosition =
        level3ExitZone.position;

    const insideExitWidth =
        Math.abs(
            r0.position.x - exitPosition.x
        ) <= level3ExitZone.userData.halfWidth;

    const insideExitDepth =
        Math.abs(
            r0.position.z - exitPosition.z
        ) <= level3ExitZone.userData.halfDepth;

    if (insideExitWidth && insideExitDepth) {
        showFinalVictory();
    }
}
function createLevel3ControlPanel() {

    if (!controlPanelModel) {
        console.warn(
            "Modelo del panel de control aún no disponible"
        );
        return;
    }

    const panel =
        controlPanelModel.clone(true);

    panel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Posición temporal
    panel.position.set(
        -5.5,
        0,
        - 9
    );

    // Primero probamos escala original
    panel.scale.set(
        0.02,
        0.02,
        0.02
    );

    panel.rotation.y = 0;

    scene.add(panel);
    panel.updateMatrixWorld(true);

    const panelBox =
        new THREE.Box3().setFromObject(panel);

    const panelSize =
        new THREE.Vector3();

    const panelCenter =
        new THREE.Vector3();

    panelBox.getSize(panelSize);
    panelBox.getCenter(panelCenter);

    const panelBody =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    panelCenter.x,
                    panelCenter.y,
                    panelCenter.z
                )
        );

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            panelSize.x * 0.48,
            panelSize.y * 0.48,
            panelSize.z * 0.48
        ),
        panelBody
    );

    panel.userData.body = panelBody;
    level3ControlPanel = panel;
    registerCameraObstacle(panel);

    console.log(
        "Collider del panel de control creado"
    );



    console.log(
        "Panel de control del Nivel 3 creado"
    );
}
function createLevel3Machinery() {

    if (!spindModel) {
        console.warn(
            "Modelo Spind aún no disponible"
        );
        return;
    }

    const spind =
        spindModel.clone(true);

    spind.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Posición temporal
    spind.position.set(
        10,
        0,
        7
    );
    spind.rotation.y = Math.PI / 2;

    // Primero medimos con su escala original
    spind.scale.set(
        5,
        5,
        5
    );

    spind.rotation.y = 0;

    scene.add(spind);
    spind.updateMatrixWorld(true);

    const spindBox =
        new THREE.Box3().setFromObject(spind);

    const spindSize =
        new THREE.Vector3();

    const spindCenter =
        new THREE.Vector3();

    spindBox.getSize(spindSize);
    spindBox.getCenter(spindCenter);

    const spindBody =
        physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    spindCenter.x,
                    spindCenter.y,
                    spindCenter.z
                )
        );

    physicsWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(
            spindSize.x * 0.48,
            spindSize.y * 0.48,
            spindSize.z * 0.09
        ),
        spindBody
    );

    spind.userData.body = spindBody;
    level3Machinery = spind;
    registerCameraObstacle(spind);

    console.log(
        "Collider del Spind creado"
    );


    console.log(
        "Maquinaria Spind del Nivel 3 creada"
    );
}

function updateLevel3Escape(delta) {

    if (
        currentLevel !== 3 ||
        !level3EscapeActive ||
        gameOver ||
        levelCompleted
    ) {
        return;
    }

    level3EscapeTimeRemaining -= delta;

    if (level3ExitZone) {
        const evacPulse =
            0.75 +
            Math.sin(performance.now() * 0.008) * 0.18;

        if (level3ExitZone.userData.marker) {
            level3ExitZone.userData.marker.rotation.y +=
                1.6 * delta;
            level3ExitZone.userData.marker.material.opacity =
                0.28 + evacPulse * 0.18;
        }

        if (level3ExitZone.userData.light) {
            level3ExitZone.userData.light.intensity =
                1.8 + evacPulse * 1.2;
        }
    }

    if (level3EscapeTimeRemaining <= 0) {
        level3EscapeTimeRemaining = 0;
        updateLevel3EscapeHud();
        gameOver = true;
        cancelPendingAttackPulse();
        level3EscapeActive = false;
        audioSystem.stopEvacAlarm();
        triggerGameOverAudio();

        gameOverTitle.textContent =
            "TIEMPO AGOTADO";

        gameOverMessage.textContent =
            "R-0 no logró evacuar Reactor Zero antes del colapso.";

        gameOverScreen
            .classList
            .remove("hidden");

        console.log(
            "DERROTA - ESCAPE FALLIDO"
        );

        return;
    }

    updateLevel3EscapeHud();
    checkLevel3Exit();
}

function showFinalVictory() {

    cancelPendingAttackPulse();
    clearObjectiveMarker();
    audioSystem.playVictory();
    levelTimerRunning = false;
    gameplayActive = false;
    updatePauseButtonVisibility();

    const evacuationBonus =
        Math.max(
            0,
            Math.floor(level3EscapeTimeRemaining) * 10
        );

    if (evacuationBonus > 0) {
        addScore(
            evacuationBonus,
            `BONO EVAC +${evacuationBonus} PTS`
        );
    }

    levelCompleted = true;
    level3EscapeActive = false;

    const levelComplete =
        document.getElementById("level-complete");
    const recoveryRows =
        levelComplete.querySelectorAll(".recovery-row");

    recoveryRows.forEach((row) => {
        row.style.display = "";
    });

    levelComplete.querySelector(".complete-id").textContent =
        "RZ-03";
    levelComplete.querySelector(".complete-status").lastChild.textContent =
        " MISSION COMPLETE";
    levelComplete.querySelector(".complete-header h2").innerHTML =
        "REACTOR ZERO <span>ESTABILIZADO</span>";
    levelComplete.querySelector(".complete-subtitle").textContent =
        "SYSTEM REPORT // MISSION COMPLETE";
    levelComplete.querySelector(".recovery-title span:last-child").textContent =
        "03 / 03";

    recoveryRows.forEach((row, index) => {

        const label =
            row.querySelector("span:first-child");
        const status =
            row.querySelector(".recovery-online");

        if (index > 2) {
            row.remove();
            return;
        }

        if (label && index === 0) {
            label.textContent =
                "SOPORTES DEL REACTOR";
        } else if (label && index === 1) {
            label.textContent =
                "EVACUACIÓN";
        } else if (label && index === 2) {
            label.textContent =
                "REACTOR ZERO";
        }

        if (status) {
            status.lastChild.textContent =
                index === 1
                    ? " COMPLETADA"
                    : " STABLE";
        }

    });

    levelComplete.querySelector(".complete-objective-number").innerHTML =
        "03 <small>/03</small>";
    levelComplete.querySelector(".complete-objective p").textContent =
        "R-0 logró evacuar la instalación antes del colapso. Reactor Zero ha sido estabilizado.";
    levelComplete.querySelector(".complete-footer span:first-child").textContent =
        "MISSION COMPLETE";
    levelComplete.querySelector(".complete-footer span:last-child").textContent =
        "REACTOR ZERO STABILIZED";
    updateFinalAuthorCredit(true);
    nextLevelButton.innerHTML =
        "<span>&#8635;</span> REINICIAR MISIÓN";

    levelComplete
        .classList
        .remove("hidden");
}

function clearLevel3Objects() {

    audioSystem.stopEvacAlarm();

    if (level3Reactor) {
        removeRigidBodyFromObject(level3Reactor);
        removeCameraObstacle(level3Reactor);
        scene.remove(level3Reactor);
        level3Reactor = null;
    }

    if (level3ControlPanel) {
        removeRigidBodyFromObject(level3ControlPanel);
        removeCameraObstacle(level3ControlPanel);
        scene.remove(level3ControlPanel);
        level3ControlPanel = null;
    }

    if (level3Machinery) {
        removeRigidBodyFromObject(level3Machinery);
        removeCameraObstacle(level3Machinery);
        scene.remove(level3Machinery);
        level3Machinery = null;
    }

    reactorSupports.forEach((support) => {

        removeRigidBodyFromObject(support);
        removeCameraObstacle(support);

        if (support.userData.energyBeam) {
            scene.remove(support.userData.energyBeam);
            support.userData.energyBeam.geometry.dispose();
            support.userData.energyBeam.material.dispose();
            support.userData.energyBeam = null;
        }

        if (support.userData.labelSprite) {
            disposeObject3D(support.userData.labelSprite);
            support.userData.labelSprite = null;
        }

        scene.remove(support);
    });

    reactorSupports.length = 0;
    destroyedReactorSupports = 0;
    level3EscapeActive = false;
    level3EscapeTimeRemaining =
        LEVEL3_ESCAPE_TIME;

    if (level3ExitZone) {
        if (level3ExitZone.userData.exitModel) {
            level3ExitZone.remove(
                level3ExitZone.userData.exitModel
            );
            level3ExitZone.userData.exitModel = null;
        }

        scene.remove(level3ExitZone);
        disposeObject3D(level3ExitZone);
        level3ExitZone = null;
    }
}

async function loadLevel3() {

    console.log(
        "Iniciando Nivel 3 - Reactor Zero"
    );

    setNextLevelLoading(
        true,
        "CARGANDO REACTOR..."
    );

    await ensureLevel3AssetsLoaded();

    currentLevel = 3;
    setLevel3Lighting();
    audioSystem.stopEvacAlarm();
    audioSystem.playLevelMusic(3);

    clearActivePulses();
    clearLevelMissionObjects();
    clearDynamicProps();
    resetLevelState();
    clearLevel1IndustrialBackdrop();
    createLevel3IndustrialBackdrop();
    clearLevel2Decorations();
    levelTimeRemaining = 120;
    updateTimerHud();

    createLevel3Reactor();
    createReactorSupports();
    createLevel3ControlPanel();
    createLevel3Machinery();
    createLevel3Exit();

    updateLevel3Hud();
    moveR0ToStart({
        x: 0,
        y: 0.05,
        z: -9
    }, {
        x: 0,
        y: 5.2,
        z: -2
    });
    configureLevelIntro(
        "NIVEL 3",
        "REACTOR ZERO",
        "NÚCLEO CRÍTICO",
        "Destruye los 3 soportes del reactor.",
        "0 / 3"
    );
    showLevelIntro(() => {
        startLevelTimer();
        showMissionNotification(
            "REACTOR ZERO // 3 SOPORTES CRÍTICOS DETECTADOS"
        );
    });

    nextLevelButton.disabled = false;
}
function createLevel3Reactor() {

    if (!reactorModel) {
        console.warn(
            "Modelo del reactor aún no disponible"
        );
        return;
    }

    const reactor = reactorModel.clone(true);

    reactor.traverse((child) => {

        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }

    });

    // Posición temporal en el centro de la sala
    reactor.position.set(
        0,
        0,
        0
    );

    // Escala inicial de prueba
    reactor.scale.set(
        0.6,
        0.6,
        0.6
    );

    reactor.rotation.y = 0;

    level3Reactor = reactor;
    registerCameraObstacle(reactor);

    scene.add(reactor);

    // ===============================
    // COLLIDER DEL REACTOR CENTRAL
    // ===============================

    const reactorBox =
        new THREE.Box3().setFromObject(reactor);

    const reactorSize =
        new THREE.Vector3();

    const reactorCenter =
        new THREE.Vector3();

    reactorBox.getSize(reactorSize);
    reactorBox.getCenter(reactorCenter);


    // Collider reducido para bloquear
    // principalmente la estructura central
    const reactorBody =
        physicsWorld.createRigidBody(

            RAPIER.RigidBodyDesc
                .fixed()
                .setTranslation(
                    reactorCenter.x,
                    reactorCenter.y,
                    reactorCenter.z
                )
        );


    physicsWorld.createCollider(

        RAPIER.ColliderDesc.cuboid(
            reactorSize.x * 0.42,
            reactorSize.y * 0.48,
            reactorSize.z * 0.42
        ),

        reactorBody
    );


    reactor.userData.body = reactorBody;

    console.log(
        "Collider del reactor central creado"
    );

    console.log(
        "Reactor central creado"
    );
}


function createTestReactorSupport() {

    if (!reactorSupportModel) {
        console.warn("Modelo del soporte aún no disponible");
        return;
    }

    const support = reactorSupportModel.clone(true);

    support.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Posición temporal para verlo claramente
    support.position.set(-6.5, 0, -3.5);

    // Primero probamos su escala original
    support.scale.set(0.0007, 0.0007, 0.0007);
    support.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(support);
    const size = new THREE.Vector3();

    box.getSize(size);

    console.log("Tamaño soporte:", {
        x: size.x,
        y: size.y,
        z: size.z
    });

    support.rotation.y = 0;

    scene.add(support);

    console.log("Soporte de prueba creado");
}










window.addEventListener(
    "keydown",
    (event) => {

        const key = event.key.toLowerCase();

        if (
            key === "f" &&
            !event.repeat &&
            !levelCompleted &&
            !gameOver &&
            !isPaused &&
            !isActionLocked &&
            gameplayActive
        ) {
            if (playR0Attack()) {
                scheduleAttackPulse();
            }
            r0Keys.f = true;
        }


        if (
            key === "e" &&
            r0 &&
            currentLevel === 1 &&
            !isPaused &&
            !isActionLocked
        ) {

            generators.forEach((generator) => {

                const distance =
                    r0.position.distanceTo(generator.position);

                if (
                    distance < 2 &&
                    !generator.userData.activated &&
                    !generator.userData.blocked &&
                    generator.name ===
                    `Generator_${activatedGenerators + 1}`
                ) {

                    generator.userData.activated = true;

                    // Indicador luminoso de generador activado

                    generator.updateMatrixWorld(true);

                    const generatorBox =
                        new THREE.Box3().setFromObject(generator);

                    const generatorCenter =
                        new THREE.Vector3();

                    generatorBox.getCenter(generatorCenter);

                    const indicatorGeometry =
                        new THREE.BoxGeometry(
                            0.22,
                            0.06,
                            0.03
                        );

                    const indicatorMaterial =
                        new THREE.MeshBasicMaterial({
                            color: 0x00ff88,
                            toneMapped: false
                        });
                    indicatorMaterial.color.multiplyScalar(2);

                    const indicatorLight =
                        new THREE.Mesh(
                            indicatorGeometry,
                            indicatorMaterial
                        );

                    indicatorLight.position.set(
                        0,
                        1.2,
                        0.6
                    );

                    generator.add(indicatorLight);

                    activatedGenerators++;
                    audioSystem.playSfx("generatorActivate");
                    addScore(100);
                    // Mostrar confirmación de activación
                    notificationMessage.textContent =
                        `GENERATOR ${String(activatedGenerators).padStart(2, "0")} // ONLINE // +100 PTS`;

                    systemNotification
                        .classList
                        .remove("hidden");

                    setTimeout(() => {

                        systemNotification
                            .classList
                            .add("hidden");

                    }, 2500);

                    if (activatedGenerators === 1) {
                        showMissionNotification(
                            "GENERATOR 01 ONLINE // +100 PTS // NUEVO OBJETIVO: GENERATOR 02"
                        );
                    } else if (activatedGenerators === 2) {
                        showMissionNotification(
                            "GENERATOR 02 ONLINE // +100 PTS // ANOMALÍA DETECTADA"
                        );
                    } else {
                        showMissionNotification(
                            "GENERATOR 03 ONLINE // +100 PTS // SECTOR RESTAURADO"
                        );
                    }

                    updateLevel1ObjectiveHud();

                    document.getElementById("objectives").textContent =
                        `${activatedGenerators} / 3`;
                    if (activatedGenerators === 3) {
                        levelCompleted = true;
                        prepareLevel1CompleteScreen();

                        console.log(
                            "NIVEL 1 COMPLETADO - ENERGÍA RESTAURADA"
                        );
                        document
                            .getElementById("level-complete")
                            .classList.remove("hidden");

                    }

                    console.log(
                        `${generator.name} ACTIVADO`
                    );

                }

            });

        }

        if (
            key === "e" &&
            r0 &&
            currentLevel === 2 &&
            gameplayActive &&
            !isPaused &&
            !isActionLocked &&
            level2RechargeStation
        ) {

            const distance =
                r0.position.distanceTo(
                    level2RechargeStation.position
                );

            if (
                distance < 3 &&
                r0Energy < 100
            ) {
                level2RechargeCount++;

                const rechargePenalty =
                    level2RechargeCount * 50;

                r0Energy = 100;
                updateEnergyHud();
                const rechargeAudio =
                    audioSystem.playSfx("energyRecharge");

                lockActionUntilAudioEnds(
                    rechargeAudio,
                    3000
                );

                subtractScore(
                    rechargePenalty,
                    `RECARGA ${String(level2RechargeCount).padStart(2, "0")} // -${rechargePenalty} PTS // PULSOS 10 / 10`
                );

                updateLevel2ObjectiveMarker();
            }
        }


        if (!isPaused && !isActionLocked && key in r0Keys) {
            r0Keys[key] = true;
        }

        if (!isPaused && !isActionLocked && event.key === "Shift") {
            r0Keys.shift = true;
        }

    }
);

window.addEventListener(
    "keyup",
    (event) => {

        const key = event.key.toLowerCase();

        if (key in r0Keys) {
            r0Keys[key] = false;
        }

        if (key === "f") {
            r0Keys.f = false;
        }

        if (event.key === "Shift") {
            r0Keys.shift = false;
        }

    }
);


function playR0Action(name) {

    const nextAction = r0Actions[name];

    if (!nextAction || currentR0Action === nextAction) {
        return;
    }

    if (currentR0Action) {
        currentR0Action.fadeOut(0.2);
    }

    nextAction
        .reset()
        .fadeIn(0.2)
        .play();

    currentR0Action = nextAction;
}


function playR0Attack() {

    const attackAction = r0Actions.attack;

    if (!attackAction) {
        return false;
    }

    isR0Attacking = true;

    if (
        currentR0Action &&
        currentR0Action !== attackAction
    ) {
        currentR0Action.fadeOut(0.2);
    }

    attackAction
        .stop()
        .reset()
        .setEffectiveWeight(1)
        .setEffectiveTimeScale(1)
        .play();

    currentR0Action = attackAction;

    return true;
}
function getPulseLaunchData() {

    const direction =
        new THREE.Vector3(
            Math.sin(r0.rotation.y),
            0,
            Math.cos(r0.rotation.y)
        );
    const rightDirection =
        new THREE.Vector3(
            Math.cos(r0.rotation.y),
            0,
            -Math.sin(r0.rotation.y)
        );

    const origin =
        r0.position.clone();

    origin.y += 0.9;
    origin.addScaledVector(
        rightDirection,
        -0.20
    );

    const spawnPosition =
        origin.clone();

    spawnPosition.addScaledVector(
        direction,
        1.4
    );

    return {
        origin: origin,
        spawnPosition: spawnPosition,
        direction: direction,
        spawnDistance: 1.4,
        radius: 0.25
    };
}

function resolveImmediatePulseHit(launchData) {

    const raycaster =
        new THREE.Raycaster(
            launchData.origin,
            launchData.direction,
            0,
            launchData.spawnDistance +
            launchData.radius
        );

    const hit =
        findClosestPulseHit(raycaster);

    if (!hit) {
        return false;
    }

    applyPulseImpact(
        hit,
        {
            direction: launchData.direction,
            hasHit: true
        }
    );

    return true;
}

function spendLevel2PulseEnergy() {

    if (currentLevel !== 2) {
        return true;
    }

    if (r0Energy < ENERGY_COST_PER_CORE_PULSE) {
        showMissionNotification(
            "PULSOS INSUFICIENTES // LOCALIZA LA ESTACIÓN DE RECARGA"
        );
        updateLevel2ObjectiveMarker(true);
        return false;
    }

    r0Energy =
        Math.max(
            0,
            r0Energy - ENERGY_COST_PER_CORE_PULSE
        );

    updateEnergyHud();
    updateLevel2ObjectiveMarker();

    return true;
}

function createEnergyPulse() {

    if (!r0) {
        return;
    }

    if (!spendLevel2PulseEnergy()) {
        return;
    }

    const launchData =
        getPulseLaunchData();

    audioSystem.playSfx("energyPulse");

    if (resolveImmediatePulseHit(launchData)) {
        return;
    }

    const pulseGeometry =
        new THREE.SphereGeometry(
            0.18,
            16,
            16
        );

    const pulseMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x00d9ff,
            transparent: true,
            opacity: 0.85,
            toneMapped: false
        });

    pulseMaterial.color.multiplyScalar(2);

    const pulse =
        new THREE.Mesh(
            pulseGeometry,
            pulseMaterial
        );
    // Halo exterior del pulso
    const glowGeometry =
        new THREE.SphereGeometry(
            0.34,
            16,
            16
        );

    const glowMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x008cff,
            transparent: true,
            opacity: 0.08,
            toneMapped: false,
            depthWrite: false
        });

    const glow =
        new THREE.Mesh(
            glowGeometry,
            glowMaterial
        );

    pulse.add(glow);

    pulse.position.copy(
        launchData.spawnPosition
    );

    scene.add(pulse);

    energyPulses.push({
        mesh: pulse,
        direction: launchData.direction,
        speed: 12,
        distanceTraveled: 0,
        radius: launchData.radius,
        hasHit: false
    });
}

function removeEnergyPulse(index) {

    const pulse = energyPulses[index];

    if (!pulse) {
        return;
    }

    scene.remove(pulse.mesh);
    disposeObject3D(pulse.mesh);

    energyPulses.splice(
        index,
        1
    );
}

function createPulseImpactEffect(position) {

    const effectGroup =
        new THREE.Group();

    const flashGeometry =
        new THREE.SphereGeometry(
            0.16,
            12,
            12
        );

    const flashMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x00d9ff,
            transparent: true,
            opacity: 0.85,
            toneMapped: false,
            depthWrite: false
        });

    const flash =
        new THREE.Mesh(
            flashGeometry,
            flashMaterial
        );

    const ringGeometry =
        new THREE.TorusGeometry(
            0.22,
            0.025,
            8,
            24
        );

    const ringMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x7df4ff,
            transparent: true,
            opacity: 0.75,
            toneMapped: false,
            depthWrite: false
        });

    const ring =
        new THREE.Mesh(
            ringGeometry,
            ringMaterial
        );

    ring.rotation.x =
        Math.PI / 2;

    effectGroup.add(flash);
    effectGroup.add(ring);

    effectGroup.position.copy(position);

    scene.add(effectGroup);

    pulseImpactEffects.push({
        group: effectGroup,
        age: 0,
        duration: 0.25,
        flashMaterial: flashMaterial,
        ringMaterial: ringMaterial
    });
}

function updatePulseImpactEffects(delta) {

    for (let i = pulseImpactEffects.length - 1; i >= 0; i--) {

        const effect =
            pulseImpactEffects[i];

        effect.age += delta;

        const progress =
            Math.min(
                effect.age / effect.duration,
                1
            );

        const scale =
            1 + progress * 2.4;

        effect.group.scale.set(
            scale,
            scale,
            scale
        );

        const opacity =
            1 - progress;

        effect.flashMaterial.opacity =
            0.85 * opacity;
        effect.ringMaterial.opacity =
            0.75 * opacity;

        if (progress >= 1) {
            scene.remove(effect.group);
            disposeObject3D(effect.group);
            pulseImpactEffects.splice(i, 1);
        }
    }
}

function addClosestPulseHit(hits, intersections, type, target) {

    if (intersections.length === 0) {
        return;
    }

    hits.push({
        type: type,
        target: target,
        point: intersections[0].point.clone(),
        distance: intersections[0].distance
    });
}

function intersectPulseTarget(raycaster, target) {

    const disabledSpriteRaycasts = [];

    target.traverse((child) => {

        if (child.isSprite) {
            disabledSpriteRaycasts.push({
                sprite: child,
                raycast: child.raycast
            });

            child.raycast = () => { };
        }

    });

    try {
        return raycaster.intersectObject(
            target,
            true
        );
    } finally {
        disabledSpriteRaycasts.forEach((entry) => {
            entry.sprite.raycast = entry.raycast;
        });
    }
}

function findClosestPulseHit(raycaster) {

    const hits = [];

    if (
        energyAnomaly &&
        currentLevel === 1 &&
        energyAnomalyHealth > 0
    ) {
        addClosestPulseHit(
            hits,
            intersectPulseTarget(
                raycaster,
                energyAnomaly
            ),
            "anomaly",
            energyAnomaly
        );
    }

    if (currentLevel === 1) {
        generators.forEach((generator) => {

            if (!generator.visible) {
                return;
            }

            addClosestPulseHit(
                hits,
                intersectPulseTarget(
                    raycaster,
                    generator
                ),
                "generator",
                generator
            );

        });
    }

    if (currentLevel === 2) {
        unstableCores.forEach((core) => {

            if (core.userData.destroyed) {
                return;
            }

            addClosestPulseHit(
                hits,
                intersectPulseTarget(
                    raycaster,
                    core
                ),
                "core",
                core
            );

        });
    }

    if (currentLevel === 3) {
        reactorSupports.forEach((support) => {

            if (support.userData.destroyed) {
                return;
            }

            addClosestPulseHit(
                hits,
                intersectPulseTarget(
                    raycaster,
                    support
                ),
                "support",
                support
            );

        });
        if (level3Reactor) {

            addClosestPulseHit(
                hits,
                intersectPulseTarget(
                    raycaster,
                    level3Reactor
                ),
                "reactor",
                level3Reactor
            );

        }

    }

    dynamicCrates.forEach((crate) => {

        addClosestPulseHit(
            hits,
            intersectPulseTarget(
                raycaster,
                crate.model
            ),
            "crate",
            crate
        );

    });

    dynamicBarrels.forEach((barrel) => {

        addClosestPulseHit(
            hits,
            intersectPulseTarget(
                raycaster,
                barrel.model
            ),
            "barrel",
            barrel
        );

    });

    if (hits.length === 0) {
        return null;
    }

    hits.sort((a, b) => {
        return a.distance - b.distance;
    });

    return hits[0];
}

function applyPulseImpact(hit, pulse) {

    createPulseImpactEffect(hit.point);

    if (hit.type === "anomaly") {
        audioSystem.playSfx("energyImpact");
        energyAnomalyHealth--;
        energyAnomalyHealth =
            Math.max(
                0,
                energyAnomalyHealth
            );

        showMissionNotification(
            energyAnomalyHealth <= 0
                ? "ANOMALÍA // INTEGRIDAD 0 / 3 // NEUTRALIZADA"
                : `ANOMALÍA // INTEGRIDAD ${energyAnomalyHealth} / 3`
        );

        console.log(
            "VIDA ANOMALÍA:",
            energyAnomalyHealth
        );

        if (energyAnomalyHealth <= 0) {

            audioSystem.playSfx("objectiveDestroyed");

            const anomalyToDestroy = energyAnomaly;

            setTimeout(() => {

                scene.remove(anomalyToDestroy);

                if (energyAnomaly === anomalyToDestroy) {
                    energyAnomaly = null;
                    const generator3 =
                        generators.find(
                            generator =>
                                generator.name === "Generator_3"
                        );

                    if (generator3) {
                        generator3.userData.blocked = false;
                    }

                    showMissionNotification(
                        "ANOMALÍA NEUTRALIZADA // GENERATOR 03 DISPONIBLE"
                    );

                    updateLevel1ObjectiveHud();
                }

                console.log(
                    "ANOMALÍA DESTRUIDA"
                );

            }, 150);
        }

        console.log(
            "PULSO IMPACTÓ LA ANOMALÍA"
        );

        return;
    }

    if (hit.type === "generator") {

        console.log(
            "PULSO BLOQUEADO POR UN GENERADOR"
        );

        return;
    }

    if (hit.type === "core") {
        audioSystem.playSfx("energyImpact");

        const core =
            hit.target;

        core.userData.health--;
        core.userData.health =
            Math.max(
                0,
                core.userData.health
            );

        const coreDisplayName =
            getCoreDisplayName(core);

        showMissionNotification(
            core.userData.health <= 0
                ? `${coreDisplayName} // INTEGRIDAD 0 / 3 // DESTRUIDO // +150 PTS`
                : `${coreDisplayName} // INTEGRIDAD ${core.userData.health} / 3`
        );

        const coreMesh =
            core.userData.coreMesh;

        if (coreMesh && coreMesh.material) {
            coreMesh.material.emissiveIntensity =
                Math.max(
                    0.4,
                    core.userData.health * 0.6
                );
        }

        console.log(
            `${core.name} VIDA:`,
            core.userData.health
        );

        if (core.userData.health <= 0) {

            core.userData.destroyed = true;
            destroyedUnstableCores++;
            audioSystem.playSfx("objectiveDestroyed");
            addScore(150);

            updateLevel2Hud();

            setTimeout(() => {

                removeUnstableCore(core);

            }, 150);

            if (destroyedUnstableCores === 5) {
                showLevel2Complete();
            }
        }

        console.log(
            "PULSO IMPACTÓ UN NÚCLEO INESTABLE"
        );

        return;
    }

    if (hit.type === "crate") {

        const crate =
            hit.target;

        crate.body.applyImpulse(
            {
                x: pulse.direction.x * 18 * pulsePhysicsPowerMultiplier,
                y: 6 * pulsePhysicsPowerMultiplier,
                z: pulse.direction.z * 18 * pulsePhysicsPowerMultiplier
            },
            true
        );
        crate.body.applyTorqueImpulse(
            {
                x: pulse.direction.z * 8 * pulsePhysicsPowerMultiplier,
                y: 0,
                z: -pulse.direction.x * 8 * pulsePhysicsPowerMultiplier
            },
            true
        );

        console.log(
            "PULSO IMPACTÓ UNA CAJA"
        );

        return;
    }



    if (hit.type === "reactor") {

        console.log(
            "PULSO BLOQUEADO POR EL REACTOR CENTRAL"
        );

        return;
    }

    if (hit.type === "support") {
        audioSystem.playSfx("energyImpact");

        const support =
            hit.target;

        support.userData.health--;
        support.userData.health =
            Math.max(
                0,
                support.userData.health
            );

        const supportNumber =
            Number(
                support.name.replace(
                    "Reactor_Support_",
                    ""
                )
            );

        const supportLabel =
            `SOPORTE ${String(supportNumber).padStart(2, "0")}`;

        showMissionNotification(
            support.userData.health <= 0
                ? `${supportLabel} // INTEGRIDAD 0 / 3 // DESTRUIDO // +200 PTS`
                : `${supportLabel} // INTEGRIDAD ${support.userData.health} / 3`
        );

        const coreMesh =
            support.userData.coreMesh;

        if (coreMesh && coreMesh.material) {
            coreMesh.material.opacity =
                Math.max(
                    0.25,
                    support.userData.health * 0.28
                );
        }

        console.log(
            `${support.name} VIDA:`,
            support.userData.health
        );

        if (support.userData.health <= 0) {

            support.userData.destroyed = true;
            destroyedReactorSupports++;
            audioSystem.playSfx("objectiveDestroyed");
            addScore(200);

            updateLevel3Hud();

            setTimeout(() => {

                removeRigidBodyFromObject(support);

                if (support.userData.energyBeam) {

                    scene.remove(
                        support.userData.energyBeam
                    );

                    support.userData.energyBeam.geometry.dispose();
                    support.userData.energyBeam.material.dispose();

                    support.userData.energyBeam = null;
                }

                if (support.userData.labelSprite) {
                    disposeObject3D(support.userData.labelSprite);
                    support.userData.labelSprite = null;
                }

                // Quitar solamente este soporte de la escena.
                // NO hacemos dispose porque los clones del GLTF
                // comparten recursos.
                removeCameraObstacle(support);
                scene.remove(support);

            }, 150);

            if (destroyedReactorSupports === 3) {
                startLevel3Escape();
            }
        }

        console.log(
            "PULSO IMPACTÓ UN SOPORTE DEL REACTOR"
        );

        return;
    }

    if (hit.type === "barrel") {

        const barrel =
            hit.target;

        barrel.body.applyImpulse(
            {
                x: pulse.direction.x * 18 * pulsePhysicsPowerMultiplier,
                y: 6 * pulsePhysicsPowerMultiplier,
                z: pulse.direction.z * 18 * pulsePhysicsPowerMultiplier
            },
            true
        );
        barrel.body.applyTorqueImpulse(
            {
                x: pulse.direction.z * 8 * pulsePhysicsPowerMultiplier,
                y: 0,
                z: -pulse.direction.x * 8 * pulsePhysicsPowerMultiplier
            },
            true
        );

        console.log(
            "PULSO IMPACTÓ UN BARRIL"
        );
    }
}

/* ===============================
   RESPONSIVE
================================ */

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);


/* ===============================
   GAME LOOP
================================ */

function animate() {

    requestAnimationFrame(animate);



    const delta = clock.getDelta();

    if (isPaused) {
        if (controls.enabled) {
            controls.update();
        }

        renderer.render(
            scene,
            camera
        );

        return;
    }

    if (
        levelTimerRunning &&
        !levelCompleted &&
        !gameOver &&
        !(
            currentLevel === 3 &&
            level3EscapeActive
        )
    ) {
        timerAccumulator += delta;

        if (timerAccumulator >= 1) {
            timerAccumulator -= 1;

            levelTimeRemaining--;
            if (levelTimeRemaining <= 0) {
                levelTimeRemaining = 0;
                levelTimerRunning = false;
                gameOver = true;
                cancelPendingAttackPulse();
                triggerGameOverAudio();

                gameOverTitle.textContent =
                    "TIEMPO AGOTADO";

                gameOverMessage.textContent =
                    "El protocolo de recuperación no se completó a tiempo.";

                gameOverScreen
                    .classList
                    .remove("hidden");

                console.log(
                    "DERROTA - TIEMPO AGOTADO"
                );
            }

            const minutes =
                Math.floor(levelTimeRemaining / 60);

            const seconds =
                levelTimeRemaining % 60;

            timerDisplay.textContent =
                `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }
    }
    if (energyAnomaly && currentLevel === 1) {
        energyAnomaly.rotation.y += 0.6 * delta;
    }

    if (currentLevel === 2) {
        unstableCores.forEach((core) => {

            if (!core.userData.destroyed) {
                core.rotation.y += 0.8 * delta;
                core.rotation.x += 0.25 * delta;
            }

        });
    }

    if (currentLevel === 3) {
        reactorSupports.forEach((support) => {

            if (!support.userData.destroyed) {
                support.rotation.y += 0.45 * delta;
            }

        });
    }

    updateLevel3Escape(delta);

    if (
        energyAnomaly &&
        r0 &&
        currentLevel === 1 &&
        !gameOver
    ) {

        const distanceToAnomaly =
            r0.position.distanceTo(
                energyAnomaly.position
            );

        if (distanceToAnomaly < 2.5) {

            const currentTime =
                performance.now();

            if (
                currentTime -
                lastAnomalyDamageTime >= 1000
            ) {
                r0Energy -= 10;
                audioSystem.playSfx("lostEnergy");

                if (r0Energy < 0) {
                    r0Energy = 0;
                }
                if (
                    r0Energy === 0 &&
                    !gameOver
                ) {
                    gameOver = true;
                    cancelPendingAttackPulse();
                    triggerGameOverAudio();
                    gameOverScreen.classList.remove("hidden");

                    console.log(
                        "DERROTA - ENERGÍA DE R-0 AGOTADA"
                    );
                }

                energyDisplay.textContent =
                    r0Energy;

                energyFill.style.width =
                    `${r0Energy}%`;

                lastAnomalyDamageTime =
                    currentTime;

                console.log(
                    "DAÑO DE ANOMALÍA:",
                    r0Energy
                );
            }
        }
    }

    if (
        r0Energy <= 0 &&
        currentLevel !== 2 &&
        !gameOver &&
        !levelCompleted
    ) {
        gameOver = true;
        cancelPendingAttackPulse();
        triggerGameOverAudio();

        gameOverTitle.textContent =
            "ENERGÍA AGOTADA";

        gameOverMessage.textContent =
            "La unidad R-0 ha perdido toda la energía.";

        gameOverScreen
            .classList
            .remove("hidden");

        console.log(
            "DERROTA - ENERGÍA DE R-0 AGOTADA"
        );
    }

    if (r0Mixer) {
        r0Mixer.update(delta);
    }

    if (r0 && gameplayActive && !levelCompleted &&
        !gameOver) {

        r0MoveDirection.set(0, 0, 0);

        if (r0Keys.w) {
            r0MoveDirection.z -= 1;
        }

        if (r0Keys.s) {
            r0MoveDirection.z += 1;
        }

        if (r0Keys.a) {
            r0MoveDirection.x -= 1;
        }

        if (r0Keys.d) {
            r0MoveDirection.x += 1;
        }

        if (isR0Attacking) {
            r0MoveDirection.set(0, 0, 0);
        } else if (
            r0MoveDirection.lengthSq() > 0 &&
            playerBody &&
            playerCollider &&
            characterController
        ) {

            r0MoveDirection.normalize();

            const speed =
                r0Keys.shift
                    ? r0RunSpeed
                    : r0WalkSpeed;

            const playerPosition =
                playerBody.translation();

            const desiredMovement = {
                x:
                    r0MoveDirection.x *
                    speed *
                    delta,
                y: 0,
                z:
                    r0MoveDirection.z *
                    speed *
                    delta
            };

            characterController.computeColliderMovement(
                playerCollider,
                desiredMovement
            );

            const correctedMovement =
                characterController.computedMovement();

            playerBody.setNextKinematicTranslation({
                x:
                    playerPosition.x +
                    correctedMovement.x,
                y: playerPosition.y,
                z:
                    playerPosition.z +
                    correctedMovement.z
            });

            r0.rotation.y =
                Math.atan2(
                    r0MoveDirection.x,
                    r0MoveDirection.z
                );

            playR0Action(
                r0Keys.shift
                    ? "run"
                    : "walk"
            );

        } else {

            playR0Action("idle");

        }
    }

    if (physicsWorld) {
        physicsWorld.step();
    }

    // ===============================
    // MOVIMIENTO DE PULSOS DE ENERGÍA
    // ===============================

    for (let i = energyPulses.length - 1; i >= 0; i--) {

        const pulse = energyPulses[i];

        const movement =
            pulse.speed * delta;

        // Detectar impacto del pulso con cajas
        const crateRaycaster =
            new THREE.Raycaster(
                pulse.mesh.position.clone(),
                pulse.direction,
                0,
                movement + pulse.radius
            );

        const closestHit =
            findClosestPulseHit(
                crateRaycaster
            );

        if (closestHit) {
            pulse.hasHit = true;

            pulse.mesh.position.copy(
                closestHit.point
            );

            applyPulseImpact(
                closestHit,
                pulse
            );

            removeEnergyPulse(i);
            continue;
        }

        // Detectar impacto con la anomalía
        if (
            energyAnomaly &&
            currentLevel === 1 &&
            energyAnomalyHealth > 0 &&
            !pulse.hasHit
        ) {
            const anomalyIntersections =
                crateRaycaster.intersectObject(
                    energyAnomaly,
                    true
                );

            if (anomalyIntersections.length > 0) {
                pulse.hasHit = true;
                energyAnomalyHealth--;

                console.log(
                    "VIDA ANOMALÍA:",
                    energyAnomalyHealth
                );

                if (energyAnomalyHealth <= 0) {

                    const anomalyToDestroy = energyAnomaly;

                    setTimeout(() => {

                        scene.remove(anomalyToDestroy);

                        if (energyAnomaly === anomalyToDestroy) {
                            energyAnomaly = null;
                            const generator3 =
                                generators.find(
                                    generator =>
                                        generator.name === "Generator_3"
                                );

                            if (generator3) {
                                generator3.userData.blocked = false;
                            }

                            showMissionNotification(
                                "ANOMALÍA NEUTRALIZADA // GENERATOR 03 DISPONIBLE"
                            );

                            updateLevel1ObjectiveHud();
                        }

                        console.log(
                            "ANOMALÍA DESTRUIDA"
                        );

                    }, 150);
                }

                console.log(
                    "PULSO IMPACTÓ LA ANOMALÍA"
                );
            }
        }

        if (
            currentLevel === 2 &&
            !pulse.hasHit
        ) {

            for (const core of unstableCores) {

                if (core.userData.destroyed) {
                    continue;
                }

                const coreIntersections =
                    crateRaycaster.intersectObject(
                        core,
                        true
                    );

                if (coreIntersections.length > 0) {

                    pulse.hasHit = true;
                    core.userData.health--;

                    const coreMesh =
                        core.userData.coreMesh;

                    if (coreMesh && coreMesh.material) {
                        coreMesh.material.emissiveIntensity =
                            Math.max(
                                0.4,
                                core.userData.health * 0.6
                            );
                    }

                    console.log(
                        `${core.name} VIDA:`,
                        core.userData.health
                    );

                    if (core.userData.health <= 0) {

                        core.userData.destroyed = true;
                        destroyedUnstableCores++;

                        updateLevel2Hud();

                        setTimeout(() => {

                            scene.remove(core);
                            disposeObject3D(core);

                        }, 150);

                        if (destroyedUnstableCores === 5) {
                            showLevel2Complete();
                        }
                    }

                    console.log(
                        "PULSO IMPACTÓ UN NÚCLEO INESTABLE"
                    );

                    break;
                }
            }
        }

        dynamicCrates.forEach((crate) => {

            const intersections =
                crateRaycaster.intersectObject(
                    crate.model,
                    true
                );

            if (
                intersections.length > 0 &&
                !pulse.hasHit
            ) {

                pulse.hasHit = true;
                crate.body.applyImpulse(
                    {
                        x: pulse.direction.x * 18,
                        y: 6,
                        z: pulse.direction.z * 18
                    },
                    true
                );
                crate.body.applyTorqueImpulse(
                    {
                        x: pulse.direction.z * 8,
                        y: 0,
                        z: -pulse.direction.x * 8
                    },
                    true
                );

                console.log(
                    "PULSO IMPACTÓ UNA CAJA"
                );

            }

        });






        pulse.mesh.position.addScaledVector(
            pulse.direction,
            movement
        );


        pulse.distanceTraveled += movement;
        // Detectar impacto con cajas dinámicas
        const pulseRaycaster =
            new THREE.Raycaster(
                pulse.mesh.position,
                pulse.direction,
                0,
                movement + pulse.radius
            );



        // Eliminar el pulso después de recorrer 15 unidades
        if (pulse.distanceTraveled >= 15) {
            removeEnergyPulse(i);
        }
    }

    updatePulseImpactEffects(delta);
    updateObjectiveMarker(delta);

    // ===============================
    // SINCRONIZAR CAJAS CON RAPIER
    // ===============================

    dynamicCrates.forEach((crate) => {

        const position =
            crate.body.translation();

        const rotation =
            crate.body.rotation();

        crate.model.position.set(
            position.x,
            position.y,
            position.z
        );

        crate.model.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );
    });
    // ===============================
    // SINCRONIZAR BARRIL CON RAPIER
    // ===============================


    dynamicBarrels.forEach((barrel) => {

        const position =
            barrel.body.translation();

        const rotation =
            barrel.body.rotation();

        barrel.model.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );

        const rotatedOffset =
            barrel.offset
                .clone()
                .applyQuaternion(
                    barrel.model.quaternion
                );

        barrel.model.position.set(
            position.x + rotatedOffset.x,
            position.y + rotatedOffset.y,
            position.z + rotatedOffset.z
        );
    });

    if (r0 && playerBody) {

        const playerPosition =
            playerBody.translation();

        r0.position.set(
            playerPosition.x,
            playerPosition.y,
            playerPosition.z
        );
        // ===============================
        // INDICADOR DE INTERACCIÓN
        // ===============================

        let promptShown = false;

        if (currentLevel === 1) {

            generators.forEach((generator) => {

                const distance =
                    r0.position.distanceTo(
                        generator.position
                    );

                if (
                    distance < 2 &&
                    !generator.userData.activated &&
                    !promptShown
                ) {
                    const generatorNumber =
                        Number(
                            generator.name.replace(
                                "Generator_",
                                ""
                            )
                        );

                    const expectedGenerator =
                        activatedGenerators + 1;

                    if (
                        generatorNumber === expectedGenerator &&
                        !generator.userData.blocked
                    ) {
                        setInteractionPrompt(
                            "E",
                            "INTERACTUAR",
                            `ACTIVAR GENERATOR ${String(generatorNumber).padStart(2, "0")}`
                        );
                    } else if (
                        generatorNumber === 3 &&
                        generator.userData.blocked &&
                        activatedGenerators === 2
                    ) {
                        setInteractionPrompt(
                            "!",
                            "BLOQUEADO",
                            "ELIMINA LA ANOMALÍA"
                        );
                    } else {
                        setInteractionPrompt(
                            "!",
                            `GENERATOR ${String(generatorNumber).padStart(2, "0")} BLOQUEADO`,
                            `ACTIVA GENERATOR ${String(expectedGenerator).padStart(2, "0")} PRIMERO`
                        );
                    }

                    promptShown = true;
                }

            });
        }

        if (
            currentLevel === 2 &&
            level2RechargeStation &&
            !promptShown
        ) {
            const distance =
                r0.position.distanceTo(
                    level2RechargeStation.position
                );

            if (distance < 3) {
                setInteractionPrompt(
                    "E",
                    "RECARGAR",
                    "ENERGÍA DE R-0"
                );

                promptShown = true;
            }
        }

        if (!promptShown) {
            hideInteractionPrompt();
        }



        // La cámara mantiene su posición relativa
        // mientras sigue a R-0
        cameraLookTarget.set(
            r0.position.x,
            r0.position.y + 1.5,
            r0.position.z
        );

        cameraPreviousTarget.copy(
            controls.target
        );

        controls.target.lerp(
            cameraLookTarget,
            0.12
        );

        cameraTargetDelta
            .copy(controls.target)
            .sub(cameraPreviousTarget);

        camera.position.add(
            cameraTargetDelta
        );

        const cameraManualGraceActive =
            performance.now() -
            lastManualCameraInputTime <
            cameraManualGraceTime;

        const shouldRealignCameraBehindR0 =
            gameplayActive &&
            !levelCompleted &&
            !gameOver &&
            !isPaused &&
            !isActionLocked &&
            r0MoveDirection.lengthSq() > 0.0001 &&
            !cameraManualGraceActive;

        if (shouldRealignCameraBehindR0) {

            const currentCameraDistance =
                THREE.MathUtils.clamp(
                    cameraRearDistance,
                    controls.minDistance,
                    controls.maxDistance
                );

            cameraRearForward
                .set(
                    Math.sin(r0.rotation.y),
                    0,
                    Math.cos(r0.rotation.y)
                )
                .normalize();

            cameraRearDesiredPosition.set(
                r0.position.x -
                cameraRearForward.x * currentCameraDistance,
                r0.position.y + cameraRearHeightOffset,
                r0.position.z -
                cameraRearForward.z * currentCameraDistance
            );

            camera.position.lerp(
                cameraRearDesiredPosition,
                cameraRearAlignStrength
            );
        }
    }

    if (controls.enabled) {
        controls.update();
    }

    updateCameraCollision();

    renderer.render(
        scene,
        camera
    );

}

animate();
