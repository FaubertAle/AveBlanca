/**
*Importamos las funciones a utilizar desde modulos externos.
*/
import * as THREE from './build/three.module.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { Octree } from './jsm/math/Octree.js';
import { Capsule } from './jsm/math/Capsule.js';

/**
*Variable para realizar un seguimiento del tiempo.
*/
const clock = new THREE.Clock();

/**
*Para poder mostrar cualquier elemento del entorno, necesitamos tres cosas:
*escena, cámara y renderizador, para renderizar la escena con cámara.
*/
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x88ccff );
		 	
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

/**
*La variable container nos permite contener como tal todo el renderizado de la escena en nuestro script.
*/
const container = document.getElementById( 'container' );
container.appendChild( renderer.domElement );

/**
*Luz ambiental
*Esta luz ilumina globalmente todos los objetos de la escena por igual.
*Esta luz no se puede utilizar para proyectar sombras ya que no tiene una dirección.
*/
const ambientlight = new THREE.AmbientLight( 0x88ccff );
scene.add( ambientlight );

/**
*Luz Escenario 1
*Esta luz es una de relleno que viene desde la parte de enfrente para poder visualizar las texturas del escenario.
*/
const fillLight1 = new THREE.DirectionalLight( 0xff9999, 0.5 );
fillLight1.position.set( - 1, 1, 2 );
scene.add( fillLight1 );

/**
*Lua Escenario 2
*Esta luz es una de relleno que viene desde la parte de atrás para poder visualizar las texturas del escenario.
*/
const fillLight2 = new THREE.DirectionalLight( 0x8888ff, 0.2 );
fillLight2.position.set( 0, - 1, 0 );
scene.add( fillLight2 );

/**
*Luz direccional 
*Es una luz que se emite en una dirección específica y proyectando sombras.
*/
const directionalLight = new THREE.DirectionalLight( 0xffffaa, 1.2 );
directionalLight.position.set( - 5, 25, - 1 );
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.01;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.right = 30;
directionalLight.shadow.camera.left = - 30;
directionalLight.shadow.camera.top	= 30;
directionalLight.shadow.camera.bottom = - 30;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.radius = 4;
directionalLight.shadow.bias = - 0.00006;
scene.add( directionalLight );
			
/**
Controla la gravedad del escenario.
*/
const GRAVITY = 30;

/**
*Controla los pasos por cuadro.
*/
const STEPS_PER_FRAME = 5;

/**
*Variable que subdivide el espacio para búsquedas espaciales rápidas.
*/
const worldOctree = new Octree();

/**
*Variable que nos permite crear el colisionador de la cámara.
*/
const playerCollider = new Capsule( new THREE.Vector3( 0, 0.2, 0 ), new THREE.Vector3( 0, 1.2, 0 ), 0.2 );

/**
*Variable que nos permite establecer la velocidad de movimiento de la cámara.
*/
const playerVelocity = new THREE.Vector3();

/**
*Variable que nos permite establecer con precisión la dirección a la que apunta la cámara.
*/
const playerDirection = new THREE.Vector3();

/**
*Variable empleada para detectar si la cámara está en el piso.
*@type {boolean}
*/
let playerOnFloor = false;

/**
*Variable empleada para detectar el cursor.
*@type {boolean}
*/
let mouseTime = 0;

/**
*Lista donde se guardan todos los eventos generados para mouse y teclado.
*@type {list}
*/
const keyStates = {};

	/**
	*Revisar estado de teclas.
	*/
	document.addEventListener( 'keydown', ( event ) => {
		keyStates[ event.code ] = true;
	} );
	
	/**
    *Revisa el estado de la tecla asignada, registra como activada o desactivada.
    */
	document.addEventListener( 'keyup', ( event ) => {
		keyStates[ event.code ] = false;
	} );
	
	/**
    *Revisa el estado del cursor, registra como activada.
    */	
	document.addEventListener( 'mousedown', () => {
		mouseTime = performance.now();
	} );
	
	/**
    *Revisa el estado del cursor, registra como desactivada.
    */	
	document.addEventListener( 'mouseup', () => {
	} );
	
	/**
    *@event Evento movimiento del mouse.
    *@fires keyStates[ 'mousemove' ]
    *@description Revisa el estado del mouse, registra su actividad de movimiento .
    */
	document.body.addEventListener( 'mousemove', ( event ) => {
		if ( document.pointerLockElement === document.body ) {
			camera.rotation.y -= event.movementX / 900;
			camera.rotation.x -= event.movementY / 900;
		}
	} );
	
	/**
	*Método para ajustar el tamaño e la ventana.
	*/
	window.addEventListener( 'resize', onWindowResize );
	
/**
*@class Función para ajustar el tamaño de la ventana (Resize).
*/
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

/**
*@class
*Función que controla todas las colisiones que se dan en todos
*los objetos del escenario, verificando cada cierto tiempo el estado de
*colisión de los objetos.
*/
function playerCollisions() {
	const result = worldOctree.capsuleIntersect( playerCollider );
	
	/**
    *@description Detecta si el observados o jugador se encuentra en el suelo.
    *@type {boolean}
    */
	playerOnFloor = false;
	if ( result ) {
		playerOnFloor = result.normal.y > 0;
		
		if ( ! playerOnFloor ) {
			playerVelocity.addScaledVector( result.normal, - result.normal.dot( playerVelocity ) );
		}
		
		playerCollider.translate( result.normal.multiplyScalar( result.depth ) );
	}
}

/**
*@class Función que actualiza la cámara, controla la velocidad, posición y movimientos.
*@param (deltaTime)
*@type {number}
*@description Variable generada en la función animate().
*/
function updatePlayer( deltaTime ) {
let damping = Math.exp( - 10 * deltaTime ) - 1;

	if ( ! playerOnFloor ) {
		/**
		*@type {number}
		*@description  Variable que depende de otra variable deltaTime para generar
		*la velocidad y simular el movimiento de la cámara.
		*/
		playerVelocity.y -= GRAVITY * deltaTime;
		damping *= 0.1;
	}

	playerVelocity.addScaledVector( playerVelocity, damping );
	
	/**
    *@description Variable para gestionar la posición según la velocidad.
    */
	const deltaPosition = playerVelocity.clone().multiplyScalar( deltaTime );
	playerCollider.translate( deltaPosition );
	playerCollisions();
	camera.position.copy( playerCollider.end );
}

/**
*@class Función que devuelve la posición la cámara con coordenadas del eje y en la posición 0.
*@return playerDirection;
*/
function getForwardVector() {
	camera.getWorldDirection( playerDirection );
	playerDirection.y = 0;
	playerDirection.normalize();
	return playerDirection;
}

/**
*@class Función que devuelve la posición de la cámara, cuando su dirección esta apuntando hacia arriba.
*@return playerDirection;
*/
function getSideVector() {
	camera.getWorldDirection( playerDirection );
	playerDirection.y = 0;
	playerDirection.normalize();
	playerDirection.cross( camera.up );
	return playerDirection;
}

/**
*@class Función que se encarga de asignar los eventos al presionar determinadas
*teclas, para generar el movimiento de la cámara en el escenario.
*@param (deltaTime)
*@type {number}
*@description Variable generada en la función animate().
*/	
function controls(deltaTime) {
	/**
    *Variable definida como velocidad para el efecto de los eventos generados.
    */
	const speedDelta = deltaTime * ( playerOnFloor ? 25 : 8 );
	
	/**
    *@event Evento tecla W y fleca arriba.
    *@fires keyStates['KeyW']
	*@fires keyStates['ArrowUp']
    *@description Evento que asigna el movimiento a la tecla W o flecha arriba para dar la sensación de avanzar.
    */
	if ( (keyStates[ 'KeyW' ] || keyStates[ 'ArrowUp' ]) ) {
		playerVelocity.add( getForwardVector().multiplyScalar( speedDelta ) );
	}
	
	/**
    *@event Evento tecla S y fleca abajo.
    *@fires keyStates['KeyS']
	*@fires keyStates['ArrowDown']
    *@description Evento que asigna el movimiento a la tecla S o flecha anajo para dar la sensación de retroceder.
    */
	if ( keyStates[ 'KeyS' ] || keyStates[ 'ArrowDown' ] ) {
		playerVelocity.add( getForwardVector().multiplyScalar( - speedDelta ) );
	}
	
	/**
    *@event Evento tecla A y flecha izquierda.
    *@fires keyStates['KeyA']
	*@fires keyStates['ArrowLeft']
    *@description Evento que a siga el movimiento a la tecla A o flecha izquierda para dar la sensación de desplazarse a la izquierda.
    */
	if ( keyStates[ 'KeyA' ] || keyStates[ 'ArrowLeft' ] ) {
		playerVelocity.add( getSideVector().multiplyScalar( - speedDelta ) );
	}
	
	/**
    *@event Evento tecla D y fleca derecha.
    *@fires keyStates['KeyD']
	*@fires keyStates['ArrowRight']
    *@description Evento que a siga el movimiento a la tecla D o flecha derecha para dar la sensación de desplazarse a la derecha.
    */
	if ( keyStates[ 'KeyD' ] || keyStates[ 'ArrowRight' ] ) {
		playerVelocity.add( getSideVector().multiplyScalar( speedDelta ) );
	}

	/**
    *@event Evento tecla Espacio.
    *@fires keyStates[ 'Space' ]
    *@description Evento asignado a la acción de activar la rotación de la cámara y el cierre de las ventanas flotantes.
    */
	if ( keyStates[ 'Space' ] ) {
		document.body.requestPointerLock();
		document.getElementById("vent1").style.display="none";
		document.getElementById("vent2").style.display="none";
		document.getElementById("vent3").style.display="none";
	}
}

/**
*Código específico para cargar los diferentes formatos de objetos 3D en
*formato GLTF o GLB para armar el escenario con colisiones.
*/
const loader = new GLTFLoader().setPath( './modelo/' );
loader.load( 'casaguayasamin.glb', ( gltf ) => {
	scene.add( gltf.scene );
	worldOctree.fromGraphNode( gltf.scene );
	gltf.scene.traverse( child => {
		
		if ( child.isMesh ) {
			child.castShadow = true;
			child.receiveShadow = true;
			
			if ( child.material.map ) {
				child.material.map.anisotropy = 8;
			}
			
		}
		
	} );
	
	animate();
	
} );

/**
*@class Función que genera la variable deltaTime. A partir de esta variable asociamos las
*funciones: controls( deltaTime ), updatePlayer( deltaTime ), y proporciona la animación 
*y colisiones a los objeto 3D  tanto en formato FBX, GLTF o GLB.
*/
function animate() {
	/**
    *Variable generada cada cierto tiempo la cual ayuda con las colisiones
    *en pasos para mitigar el riesgo de que un objeto atraviese a otro demasiado
    *rápido para ser detectado.
    */
	const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;
	
	for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
		controls( deltaTime );
		updatePlayer( deltaTime );
	}
	
	renderer.render( scene, camera );
	requestAnimationFrame( animate );
	
}