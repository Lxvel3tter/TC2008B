/*
 * Tarea CG_1: cara 2D hecha de triángulos con transformaciones por matrices.
 * La rotación es alrededor de un pivote y el orden de las transformaciones
 * se puede cambiar desde el menú de lil-gui.
 * Basado en el código de Gilberto Echeverria
 */

'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { V2, M3, type Mat3 } from '../libs/2d-lib.js';
import { Scene } from '../libs/scene.js';
import { Object3D } from '../libs/object3d.js';

// Shaders en archivos separados
import vsGLSL from './vs_matrices_vcolor.glsl?raw';
import fsGLSL from './fs_vertex_color.glsl?raw';


// Cara: cabeza de 12 triángulos, dos ojos y una boca
function smiley(radius: number): twgl.Arrays {
    const positionData: number[] = [];
    const colorData: number[] = [];
    const indexData: number[] = [];

    const r = radius;
    const s = radius * 0.5;
    const h = radius * 0.866;

    // Cabeza: vértice 0 es el centro, del 1 al 12 es el borde
    positionData.push(0, 0);
    positionData.push(0, r);
    positionData.push(-s, h);
    positionData.push(-h, s);
    positionData.push(-r, 0);
    positionData.push(-h, -s);
    positionData.push(-s, -h);
    positionData.push(0, -r);
    positionData.push(s, -h);
    positionData.push(h, -s);
    positionData.push(r, 0);
    positionData.push(h, s);
    positionData.push(s, h);

    // Ojo izquierdo
    positionData.push(-0.6 * r, 0.2 * r);
    positionData.push(-0.4 * r, 0.2 * r);
    positionData.push(-0.5 * r, 0);

    // Ojo derecho
    positionData.push(0.4 * r, 0.2 * r);
    positionData.push(0.6 * r, 0.2 * r);
    positionData.push(0.5 * r, 0);

    // Boca
    positionData.push(-0.5 * r, -0.5 * r);
    positionData.push(0.5 * r, -0.5 * r);
    positionData.push(0, -0.65 * r);

    // Amarillo para la cabeza (13 vértices)
    for (let i = 0; i < 13; i++) {
        colorData.push(1, 1, 0, 1);
    }
    // Negro para ojos y boca (9 vértices)
    for (let i = 0; i < 9; i++) {
        colorData.push(0, 0, 0, 1);
    }

    // 12 triángulos de la cabeza, del centro a cada par de vértices del borde
    for (let i = 1; i <= 12; i++) {
        indexData.push(0, i, (i % 12) + 1);
    }

    // Ojos y boca
    indexData.push(13, 14, 15);
    indexData.push(16, 17, 18);
    indexData.push(19, 20, 21);

    return {
        a_position: { numComponents: 2, data: positionData },
        a_color:    { numComponents: 4, data: colorData },
        indices:    { numComponents: 3, data: indexData },
    };
}

// Pivote: un rombo de 2 triángulos
function diamond(size: number): twgl.Arrays {
    return {
        a_position: {
            numComponents: 2,
            data: [
                size, 0,
                0, size,
                -size, 0,
                0, -size,
            ]
        },
        a_color: {
            numComponents: 4,
            data: [
                0.5, 0.5, 0.5, 1,
                0.5, 0.5, 0.5, 1,
                0.5, 0.5, 0.5, 1,
                0.5, 0.5, 0.5, 1,
            ]
        },
        indices: {
            numComponents: 3,
            data: [
                0, 1, 2,
                2, 3, 0,
            ]
        }
    };
}

// Opciones del dropdown, de izquierda a derecha es el orden en que se aplican
const ORDERS = [
    'scale -> rotation -> translation',
    'scale -> translation -> rotation',
    'translation -> scale -> rotation',
    'rotation -> translation -> scale',
    'rotation -> scale -> translation',
];


class FaceScene extends Scene {
    private settings = { order: ORDERS[1] };

    constructor(gl: WebGL2RenderingContext) {
        super(gl, vsGLSL, fsGLSL);

        const face = this.addObject('face', smiley(150), [1, 1, 1, 1]);
        face.transforms.t.x = gl.canvas.width / 2;
        face.transforms.t.y = gl.canvas.height / 2;

        // El pivote empieza a la derecha para que se note la rotación
        const pivot = this.addObject('pivot', diamond(30), [1, 1, 1, 1]);
        pivot.transforms.t.x = gl.canvas.width / 2 + 200;
        pivot.transforms.t.y = gl.canvas.height / 2;
    }

    // Arma la matriz de la cara según el orden elegido en el menú
    private buildFaceMatrix(): Mat3 {
        const face = this.getObject('face');
        const pivot = this.getObject('pivot');

        const translation = M3.translation(V2.create(face.transforms.t.x, face.transforms.t.y));
        const scale = M3.scale(V2.create(face.transforms.s.x, face.transforms.s.y));

        // Rotación alrededor del pivote: pivote al origen, rotar, regresar
        const toOrigin = M3.translation(V2.create(-pivot.transforms.t.x, -pivot.transforms.t.y));
        const back = M3.translation(V2.create(pivot.transforms.t.x, pivot.transforms.t.y));
        const rotation = M3.multiply(back, M3.multiply(M3.rotation(face.transforms.rr.z), toOrigin));

        const matrices: Record<string, Mat3> = { scale, rotation, translation };

        // La primera transformación queda hasta la derecha del producto
        let result = M3.identity();
        for (const name of this.settings.order.split(' -> ')) {
            result = M3.multiply(matrices[name], result);
        }
        return result;
    }

    private drawObject(object: Object3D, matrix: Mat3): void {
        const { gl, programInfo } = this;
        twgl.setUniforms(programInfo, {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_transforms: matrix,
        });
        gl.bindVertexArray(object.vao);
        twgl.drawBufferInfo(gl, object.bufferInfo);
    }

    protected render(): void {
        const { gl, programInfo } = this;
        const pivot = this.getObject('pivot');

        gl.useProgram(programInfo.program);

        this.drawObject(this.getObject('face'), this.buildFaceMatrix());

        // El pivote solo lleva traslación
        const pivotMatrix = M3.translation(V2.create(pivot.transforms.t.x, pivot.transforms.t.y));
        this.drawObject(pivot, pivotMatrix);
    }

    setupUI(): void {
        const { gl } = this;
        const face = this.getObject('face');
        const pivot = this.getObject('pivot');

        const gui = new GUI();

        gui.add(this.settings, 'order', ORDERS).name('Orden');

        const faceFolder = gui.addFolder('Cara');

        const traFolder = faceFolder.addFolder('Translation');
        traFolder.add(face.transforms.t, 'x', 0, gl.canvas.width);
        traFolder.add(face.transforms.t, 'y', 0, gl.canvas.height);

        const rotFolder = faceFolder.addFolder('Rotation');
        rotFolder.add(face.transforms.rr, 'z', 0, Math.PI * 2);

        const scaFolder = faceFolder.addFolder('Scale');
        scaFolder.add(face.transforms.s, 'x', 0.1, 3);
        scaFolder.add(face.transforms.s, 'y', 0.1, 3);

        const pivotFolder = gui.addFolder('Pivot');
        pivotFolder.add(pivot.transforms.t, 'x', 0, gl.canvas.width);
        pivotFolder.add(pivot.transforms.t, 'y', 0, gl.canvas.height);
    }
}

function main(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error('No canvas element found in the document');
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 is not supported by this browser');
    }

    const scene = new FaceScene(gl);
    scene.setupUI();
    scene.draw(0);
}

main()