"use strict";
/*
    <Done> Ensure Canvas is the correct size and shrinks with window

    <Done> Create texture Array
        - Follow https://webglfundamentals.org/webgl/lessons/webgl-2-textures.html

    <Done> Create Quad for fish and floorplane
        - Vert positions, normals, UV's for 4 verticies

    <Done> Create Spawner for fish
        - Once Happy is close to a fish, consider it collected
        - Once Happy collects a fish, put the fish in a random location
        - Run simple Up/Down Hover animation

    <Done> Create Light Data
        - Light Position, matrix, type

    <Done> Modify Shader/Rendering
        - Enable backface culling
        - Add Smoothstep to shader
        - Switch to soft light blending (currently just Multiply)

    <Done> Create Shadow Projection
        - Projection matrix based on the light
        - Follow shadow.js example in chap5

    <Done> Create event based animator
        - Loop idle animation
        - Add listener for movement
        - Smoothly rotate Happy in place to point towards the location
        - Lerp Happy's location and start passing run animation to shader

    Extras:
    <Done> Rotate camera to follow the direction of happy
*/

var canvas;
var gl;
var aspect;
var ELEMENT_COUNT = 5;
var QUAD_COUNT = 2;
var SHADOW_COUNT = 1;
var TOTAL = 8;

var happy_indices = new Array(ELEMENT_COUNT);
var numVerticesInAllFaces = new Array(ELEMENT_COUNT);
var happy_vertices = new Array(ELEMENT_COUNT);
var happy_object = new Array(ELEMENT_COUNT);
var happy_normals = new Array(ELEMENT_COUNT);
var happy_texture_coords = new Array(ELEMENT_COUNT);

var normalMatrix;
var normalMatrixLoc = new Array(TOTAL);
var lightPosition = vec4(5.0, 18.0, 5.0, 0.0 );
var lightAmbient = vec4(0.05, 0.05, 0.05, 1.0 );
var lightDiffuse = vec4( 0.9, 0.9, 0.9, 1.0);
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var shaderIndex = [1,2,2,2,1,1,1,3];
var textureIndex = [0,-1,-1,-1,1,2,3,-1];
var typeIndex = [0,0,0,0,0,1,1,2];

var colorBuf = [
                vec4( 0, 0, 0, 1),
                vec4( 0.15, 0.15, 0.15, 1),
                vec4( 0.25, 0.25, 0.25, 1),
                vec4( 1, 1, 1, .05),
                vec4( 0, 0, 0, 1),
                vec4( 0, 0, 0, 1),
                vec4( 0, 0, 0, 1),
                vec4( 0.2, 0.2, 0.2, 1)
                ];

var posLoc = new Array(TOTAL);
var happyPos = vec2(0.0,0.0);
var happyLoc = new Array(TOTAL);
var happyTheta = 0;
var thetaLoc = new Array(TOTAL);
var yLevelLoc;
var fishCollected = -1;

var animate_l;
var animate_r;
var animate_t;
var animate_d;
var moving = false;
var time_buf = 0;
var run_frame_time = 20.83; //framerate times 1000 for miliseconds
var idle_frame_time = 58.82; //framerate times 1000 for miliseconds
var frame = 0;
var final_frame = 17;

var floor_size = 40;
var quad_vertices = [
    [vec3( 0, 0, 0), vec3( 0, 2, 0), vec3( 3.25, 2, 0), vec3( 3.25, 0, 0)],
    [vec3( -floor_size, 0, -floor_size), vec3( -floor_size, 0, floor_size), vec3( floor_size, 0, floor_size), vec3( floor_size, 0, -floor_size)]
];
var uvs = [[1, 1], [1, 0], [0, 0], [0, 1]];
var quad_normals = [vec3( 0, 1, 0), vec3( 0, 1, 0), vec3( 0, 1, 0), vec3( 0, 1, 0)];   //TODO: use correct values

// #region Load Meshes

function loadedBag(data, _callback)
{
	happy_object[4] = loadOBJFromBuffer(data);
	happy_indices[4] = bag_i;
	happy_vertices[4] = happy_object[4].c_verts;
	numVerticesInAllFaces[4] = bag_i.length;
	happy_normals[4] = getOrderedNormalsFromObj(happy_object[4], bag_i);
	happy_texture_coords[4] = getOrderedTextureCoordsFromObj(happy_object[4], bag_i);
	_callback();
}
function loadedEyes(data, _callback)
{
	happy_object[3] = loadOBJFromBuffer(data);
	happy_indices[3] = eyes_i;
	happy_vertices[3] = happy_object[3].c_verts;
	numVerticesInAllFaces[3] = eyes_i.length;
	happy_normals[3] = getOrderedNormalsFromObj(happy_object[3], eyes_i);
	happy_texture_coords[3] = getOrderedTextureCoordsFromObj(happy_object[3], eyes_i);
	_callback();
}
function loadedFeatures(data, _callback)
{
	happy_object[2] = loadOBJFromBuffer(data);
	happy_indices[2] = features_i;
	happy_vertices[2] = happy_object[2].c_verts;
	numVerticesInAllFaces[2] = features_i.length;
	happy_normals[2] = getOrderedNormalsFromObj(happy_object[2], features_i);
	happy_texture_coords[2] = getOrderedTextureCoordsFromObj(happy_object[2], features_i);
	_callback();
}
function loadedOutline(data, _callback)
{
	happy_object[1] = loadOBJFromBuffer(data);
	happy_indices[1] = outline_i;
	happy_vertices[1] = happy_object[1].c_verts;
	numVerticesInAllFaces[1] = outline_i.length;
	happy_normals[1] = getOrderedNormalsFromObj(happy_object[1], outline_i);
	happy_texture_coords[1] = getOrderedTextureCoordsFromObj(happy_object[1], outline_i);
	_callback();
}
function loadedHappy(data, _callback)
{
	happy_object[0] = loadOBJFromBuffer(data);
	happy_indices[0] = happy_i;
	happy_vertices[0] = happy_object[0].c_verts;
	numVerticesInAllFaces[0] = happy_i.length;
	happy_normals[0] = getOrderedNormalsFromObj(happy_object[0], happy_i);
	happy_texture_coords[0] = getOrderedTextureCoordsFromObj(happy_object[0], happy_i);
	_callback();
}
// #endregion

// #region getOrdered Stuff

function getOrderedNormalsFromObj(obj_object,imported_index){
	var normalsOrderedWithVertices = [];
	for(var i = 0; i < obj_object.i_norms.length; i++){
		normalsOrderedWithVertices[3*imported_index[i]] = obj_object.c_norms[3*obj_object.i_norms[i]];
		normalsOrderedWithVertices[3*imported_index[i]+1] = obj_object.c_norms[3*obj_object.i_norms[i]+1];
		normalsOrderedWithVertices[3*imported_index[i]+2] = obj_object.c_norms[3*obj_object.i_norms[i]+2];
	}
	return normalsOrderedWithVertices;
}

function getOrderedTextureCoordsFromObj(obj_object, imported_index){
	var texCoordsOrderedWithVertices = [];
	for(var i = 0; i < obj_object.i_uvt.length; i++){
		texCoordsOrderedWithVertices[2*imported_index[i]] = obj_object.c_uvt[2*obj_object.i_uvt[i]];
		texCoordsOrderedWithVertices[2*imported_index[i]+1] = obj_object.c_uvt[2*obj_object.i_uvt[i]+1];
	}
	return texCoordsOrderedWithVertices;
}
//#endregion

var textures = [];
function setupAfterDataLoad(){

	gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
	gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	//Load images from .html
    var images = [
        document.getElementById("texImage"),
        document.getElementById("texImage2"),
        document.getElementById("texImage3"),
        document.getElementById("texImage4")];

    //Create i textures
    for (var i = 0; i < 4; ++i) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);

        // add the texture to the array of textures.
        textures.push(texture);
    }

    setupShaderBuffers();

    render();
}

//#region read Stuff

function readBag(){
    loadOBJFromPath("happyData/base/bag.obj", loadedBag, setupAfterDataLoad);
}
function readEyes(){
    loadOBJFromPath("happyData/base/eyes.obj", loadedEyes, readBag);
}
function readFeatures(){
    loadOBJFromPath("happyData/base/features.obj", loadedFeatures, readEyes);
}
function readOutline(){
    loadOBJFromPath("happyData/base/outline.obj", loadedOutline, readFeatures);
}
//#endregion

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
	aspect =  canvas.width/canvas.height;
    gl.clearColor( 1.0,1.0, 1.0, 0.0 );

    window.addEventListener("keydown", function(){
        switch(event.keyCode) {
            case 87:  // up
                animate_d = false;
                animate_t = true;
                break;
            case 83:  // down
                animate_t = false;
                animate_d = true;
                break;
            case 65: // left
                animate_r = false;
                animate_l = true;
                break;
            case 68: // right
                animate_l = false;
                animate_r = true;
                break;
            }
    }, true);

    window.addEventListener("keyup", function(){
        switch(event.keyCode) {
            case 87:  // up
                animate_t = false;
                animate_d = false;
                break;
            case 83:  // down
                animate_t = false;
                animate_d = false;
                break;
            case 65: // left
                animate_l = false;
                animate_r = false;
                break;
            case 68: // right
                animate_l = false;
                animate_r = false;
                break;
            }
    }, true);

    loadOBJFromPath("happyData/base/happy.obj", loadedHappy, readOutline);

}

//TODO: make into array
var prog = new Array(TOTAL);

var m;

var vBuffer = new Array(TOTAL);
var nBuffer = new Array(TOTAL);
var iBuffer = new Array(TOTAL);
var vPosition = new Array(TOTAL);
var vNormCoord = new Array(TOTAL);
var projectionMatrix;
var projectionMatrixLoc = new Array(TOTAL);
var shadow_modelViewMatrix;
var modelViewMatrix;
var modelViewMatrixLoc = new Array(TOTAL);
var tBuffer = new Array(TOTAL);
var vTexCoord = new Array(TOTAL);

function setupShaderBuffers(){

    m = mat4();
    m[3][3] = 0;
    m[3][1] = -1/lightPosition[1];

    for (var i = 0; i < TOTAL; i++){

        //  Load shaders and initialize attribute buffers
        if (shaderIndex[i] == 1){
            prog[i] = initShaders( gl, "vertex-shader1", "fragment-shader1" );
        } else if (shaderIndex[i] == 2){
            prog[i] = initShaders( gl, "vertex-shader2", "fragment-shader2" );
        } else {
            prog[i] = initShaders( gl, "vertex-shader3", "fragment-shader3" );
        }
        gl.useProgram( prog[i] );

        happyLoc[i] = gl.getUniformLocation(prog[i], "happyPos");
        thetaLoc[i] = gl.getUniformLocation(prog[i], "theta");
        if(i == ELEMENT_COUNT){
          yLevelLoc = gl.getUniformLocation(prog[i], "yLevel");
        }
        //configure textures as needed
        if (textureIndex[i] >= 0){
            var textureLocation = gl.getUniformLocation(prog[i], "texture");
            gl.uniform1i(textureLocation, textureIndex[i]);
            switch (textureIndex[i]){
                case 0:
                    gl.activeTexture(gl.TEXTURE0);
                    break;
                case 1:
                    gl.activeTexture(gl.TEXTURE1);
                    break;
                case 2:
                    gl.activeTexture(gl.TEXTURE2);
                    break;
                case 3:
                    gl.activeTexture(gl.TEXTURE3);
                    break;
            }
            gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex[i]]);

            tBuffer[i] = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, tBuffer[i]);
            if (typeIndex[i] == 0){
                gl.bufferData( gl.ARRAY_BUFFER, flatten(happy_texture_coords[i]), gl.STATIC_DRAW);
            } else if (typeIndex[i] == 2){
                gl.bufferData( gl.ARRAY_BUFFER, flatten(happy_texture_coords[1]), gl.STATIC_DRAW);
            } else {
                gl.bufferData( gl.ARRAY_BUFFER, flatten(uvs), gl.STATIC_DRAW);
            }

            vTexCoord[i] = gl.getAttribLocation( prog[i], "texture_coords" );
        } else {
            var colLoc = gl.getUniformLocation( prog[i], "color" );
            gl.uniform4fv( colLoc, colorBuf[i]);
        }

        // array element buffer
        if (typeIndex[i] == 0){
            iBuffer[i] = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer[i]);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(happy_indices[i]), gl.STATIC_DRAW);
        } else if (typeIndex[i] == 2){
            iBuffer[i] = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer[i]);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(happy_indices[1]), gl.STATIC_DRAW);
        }

        // vertex array attribute buffer
        vBuffer[i] = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer[i] );
        if (typeIndex[i] == 0){
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(happy_vertices[i]), gl.STATIC_DRAW );
        } else if (typeIndex[i] == 2) {
            gl.bufferData( gl.ARRAY_BUFFER, flatten(happy_vertices[1]), gl.STATIC_DRAW); 
        } else {
            gl.bufferData( gl.ARRAY_BUFFER, flatten(quad_vertices[i-ELEMENT_COUNT]), gl.STATIC_DRAW );
        }

        nBuffer[i] = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer[i]);
        if (typeIndex[i] == 0){
            gl.bufferData( gl.ARRAY_BUFFER, flatten(happy_normals[i]), gl.STATIC_DRAW);             //Change to DYNAMIC_DRAW?
        } else if (typeIndex[i] == 2) {
            gl.bufferData( gl.ARRAY_BUFFER, flatten(happy_normals[1]), gl.STATIC_DRAW); 
        } else {
            gl.bufferData( gl.ARRAY_BUFFER, flatten(quad_normals), gl.STATIC_DRAW);
        }

        modelViewMatrixLoc[i] = gl.getUniformLocation( prog[i], "modelViewMatrix" );
        projectionMatrixLoc[i] = gl.getUniformLocation( prog[i], "projectionMatrix" );
        normalMatrixLoc[i] = gl.getUniformLocation( prog[i], "normalMatrix" );
        //Lighting
        gl.uniform4fv( gl.getUniformLocation(prog[i], "lightPosition"),flatten(lightPosition) );
        gl.uniform4fv( gl.getUniformLocation(prog[i], "lightAmbient"),flatten(lightAmbient) );
	    gl.uniform4fv( gl.getUniformLocation(prog[i], "lightDiffuse"),flatten(lightDiffuse) );
	    gl.uniform4fv( gl.getUniformLocation(prog[i], "lightSpecular"),flatten(lightSpecular) );	

        vPosition[i] = gl.getAttribLocation( prog[i], "vPosition" );
        vNormCoord[i] = gl.getAttribLocation( prog[i], "normals" );
    }
}

function renderElements(frame, start, end){
    for (var i = start; i < end; i++){
        gl.useProgram( prog[i] );

        gl.uniform2fv(happyLoc[i], happyPos);
        gl.uniform1f(thetaLoc[i], happyTheta);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer[i]);

        gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer[i] );
        if (moving){
            switch (i){
                case 0:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(happy_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 1:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 2:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(features_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 3:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(eyes_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 4:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(bag_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                default:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_run_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
            }
        } else {
            switch (i){
                case 0:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(happy_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 1:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 2:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(features_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 3:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(eyes_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 4:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(bag_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
                default:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_pos[frame]), gl.DYNAMIC_DRAW );
                    break;
            }
        }
        
        gl.vertexAttribPointer( vPosition[i], 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vPosition[i] );

        if (textureIndex[i] >= 0){
            gl.bindBuffer( gl.ARRAY_BUFFER, tBuffer[i] );
            gl.vertexAttribPointer( vTexCoord[i], 2, gl.FLOAT, false, 0, 0 );
            gl.enableVertexAttribArray( vTexCoord[i] );
        }

        gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer[i] );
        if (moving){
            switch (i){
                case 0:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(happy_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 1:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 2:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(features_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 3:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(eyes_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 4:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(bag_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                default:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_run_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
            }
        } else {
            switch (i){
                case 0:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(happy_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 1:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 2:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(features_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 3:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(eyes_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                case 4:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(bag_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
                default:
                    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(outline_norm[frame]), gl.DYNAMIC_DRAW );
                    break;
            }
        }
        gl.vertexAttribPointer( vNormCoord[i], 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vNormCoord[i] );

        if (i==7){
            gl.uniformMatrix4fv( modelViewMatrixLoc[i], false, flatten(shadow_modelViewMatrix) );
        }else {
            gl.uniformMatrix4fv( modelViewMatrixLoc[i], false, flatten(modelViewMatrix) );
        }
        gl.uniformMatrix4fv( projectionMatrixLoc[i], false, flatten(projectionMatrix) );
        gl.uniformMatrix3fv( normalMatrixLoc[i], false, flatten(normalMatrix) );

        if (i==7){
            gl.drawElements( gl.TRIANGLES, numVerticesInAllFaces[1], gl.UNSIGNED_SHORT, 0 );
        }else {
            gl.drawElements( gl.TRIANGLES, numVerticesInAllFaces[i], gl.UNSIGNED_SHORT, 0 );
        }
    }
}

//#region fish manipulation
var upDown = "up";
var fishPos = vec2(0.0,0.0);
function moveFish(direction) {
  if(direction == "up") {
    return 0.02;
  } else if(direction == "down"){
    return -0.02;
  } else if(direction == "x-z") {
    fishPos = vec2(Math.floor(Math.random()*40) - 20, Math.floor(Math.random()*40) - 20);
  }
}

function collect(happyPos, fishPos){

    if( (Math.abs(happyPos[0] - (fishPos[0] + 1.625)) <= 3) && (Math.abs(happyPos[1] - fishPos[1]) <= 3) ) {
        return true;
    }
        return false;
}

var fishLevel = 1.0;
//#endregion

function renderQuads(i) {
    gl.useProgram(prog[i]);
    if(i == ELEMENT_COUNT){
        if(fishLevel >= 3.0){
        upDown = "down";
        } else if(fishLevel <= 1.0){
        upDown = "up";
        }
        fishLevel += moveFish(upDown);
        if(collect(happyPos, fishPos)){
        fishCollected++;
        document.getElementById("fish").innerHTML = "Fish Collected: " + fishCollected;
        moveFish("x-z");
        }
        gl.uniform2fv(happyLoc[ELEMENT_COUNT], fishPos);
        gl.uniform1f(yLevelLoc, fishLevel);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer[i]);
    gl.vertexAttribPointer( vPosition[i], 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition[i] );

    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer[i]);
    gl.vertexAttribPointer( vTexCoord[i], 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vTexCoord[i] );

    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer[i] );
    gl.vertexAttribPointer( vNormCoord[i], 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormCoord[i] );

    gl.uniformMatrix4fv( modelViewMatrixLoc[i], false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc[i], false, flatten(projectionMatrix) );
    gl.uniformMatrix3fv( normalMatrixLoc[i], false, flatten(normalMatrix) );

    gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );
}

var now, elapsed_time;
var prev_time = 0;
var rotGoal = 0;
var move_time_buf = 0;
var move_frame_time = 16.66;

function animate(){
    now = Date.now();
    elapsed_time = now - prev_time;
    prev_time = now;
    time_buf+= elapsed_time;
    move_time_buf+= elapsed_time;

    var speed = .4;
    if ((animate_l || animate_r) && (animate_t || animate_d)){
        speed = .4 * .707;
        moving = true;
    } else if (!(animate_l || animate_r || animate_t || animate_d)){
        if (moving){
            moving = false;
            frame = 0;
        }
    } else {
        moving = true;
    }

    if (move_time_buf >= move_frame_time){
        move_time_buf = 0;
        if (animate_l && happyPos[0] < 20.0) {
            rotGoal = -90;
            happyPos[0] += speed;
        } else if (animate_r && happyPos[0] > -20.0) {
            rotGoal = 90;
            happyPos[0] -= speed;
        }
        if (animate_t && happyPos[1] < 20.0) {
            rotGoal = 180;
            happyPos[1] += speed;
        } else if (animate_d && happyPos[1] > -20.0) {
            rotGoal = 0;
            happyPos[1] -= speed;
        }
        if (animate_t && animate_l) rotGoal = -135;
        if (animate_t && animate_r) rotGoal = 135;
        if (animate_d && animate_l) rotGoal = -45;
        if (animate_d && animate_r) rotGoal = 45;
    
        if (happyTheta != rotGoal){
            if (rotGoal-happyTheta > 180){
                happyTheta +=360;
            }
            if (rotGoal-happyTheta < -180){
                happyTheta -=360;
            }
            if (rotGoal > happyTheta){
                happyTheta += 15;
            }
            if (rotGoal < happyTheta){
                happyTheta -= 15;
            }
        }
    }

    if (!moving && time_buf >= idle_frame_time){
        time_buf = 0;
        frame++;
    } else if (moving && time_buf >= run_frame_time){
        time_buf = 0;
        frame++;
    }
}

function render()
{
    animate();

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	//Setup ModelView and Projection Matrices.
	var eye = vec3(0.0, 18.0, -30.0);
	var at = vec3(happyPos[0], 1.0, happyPos[1]);
	var up = vec3(0.0, 1.0, 0.0);

	modelViewMatrix = lookAt( eye, at, up );
	projectionMatrix = perspective(75, aspect, 0.1, 200);

    shadow_modelViewMatrix = mult(modelViewMatrix, translate(lightPosition[0], lightPosition[1], lightPosition[2]));
    shadow_modelViewMatrix = mult(shadow_modelViewMatrix, m);
    shadow_modelViewMatrix = mult(shadow_modelViewMatrix, translate(-lightPosition[0], -lightPosition[1], -lightPosition[2]));

	normalMatrix = [
        vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]),
        vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]),
        vec3(modelViewMatrix[2][0], modelViewMatrix[2][1], modelViewMatrix[2][2])
    ];

	renderElements(frame,0,ELEMENT_COUNT);

    renderQuads(ELEMENT_COUNT+1);

	renderElements(frame,TOTAL-SHADOW_COUNT,TOTAL);

    renderQuads(ELEMENT_COUNT);

    if (frame == final_frame){
        frame = 0;
    }

    requestAnimFrame( render );
}
