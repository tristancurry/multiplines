const dpRounding = ROUNDING_DECIMAL_POINTS;
let scale_factor = SCALE_FACTOR_DEFAULT;
let divide = false; 
let scaling = false;

let static_axis_min = STATIC_AXIS_MIN;
let static_axis_max = STATIC_AXIS_MAX;

let zeroPos = 0;

const xmlns = 'http://www.w3.org/2000/svg';
const xlink = 'http://www.w3.org/1999/xlink';

//give all relevant HTML/SVG elements a reference
//there's probably some packaging into arrays and/or generation in JS that
//could make this less wordy.
const numberlines = document.getElementById('numberlines');
const layered = document.getElementById('layered');
const svg_box = document.getElementsByTagName('svg')[0];

//at some point around here need to bundle some of these things into a function
//set the viewBox units to match the aspect ratio set in config.js
if(ASPECT_RATIO) {
    svg_box.setAttribute('viewBox', `0 0 ${ASPECT_RATIO*100} 100`);
} else {
    svg_box.setAttribute('viewBox', `0 0 1770 100`);
}

let svg_vals = svg_box.viewBox.baseVal;
let svg_limits = {min: svg_vals.x, max: svg_vals.x + svg_vals.width};

const indicator = document.getElementById('indicator'); //this one is the template for all indicators

const svg_static = document.getElementById('svg_static');
const axis_static = document.getElementById('axis_static');
const ticks_static = svg_static.getElementsByClassName('tickmarks')[0];

const svg_dynamic = document.getElementById('svg_dynamic');
const axis_dynamic = document.getElementById('axis_dynamic');
const ticks_dynamic = svg_dynamic.getElementsByClassName('tickmarks')[0];

const label_scale = document.getElementById('label_scale');
const label_slider = document.getElementById('label_slider');
const label_group = document.getElementById('labels');


const range_eqn = document.getElementById('range_eqn');
const range_scale = document.getElementById('range_scale');
const range_zero = document.getElementById('range_zero');
range_scale.value = scale_factor;

const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');


//from here there's a bunch of geometry and layout things.
//TODO: bundle into a 'refresh' function that can be called if the geometry needs to be changed dynamically
const params_static = {min:STATIC_AXIS_MIN, max:STATIC_AXIS_MAX, x:map_value(0, STATIC_AXIS_MIN, STATIC_AXIS_MAX, svg_limits.min, svg_limits.max), y:svg_vals.y + 2*TICKMARK_HEIGHT, spacing:svg_vals.width/(STATIC_AXIS_MAX - STATIC_AXIS_MIN), reverse:false, div:'numbers_static'};
const params_dynamic = {x:params_static.x, y:svg_vals.y + svg_vals.height - 2*TICKMARK_HEIGHT, reverse:false, div:'numbers_dynamic'};


range_scale.setAttribute('min', `${params_static.min}`);
range_scale.setAttribute('max', `${params_static.max}`);


//now make sure the axes, input ranges and indicators are visually aligned to these params...
axis_static.setAttribute('d', `m${svg_vals.x} ${params_static.y}h${svg_vals.width}`);
axis_dynamic.setAttribute('d', `m${svg_vals.x} ${params_dynamic.y}h${svg_vals.width}`);
indicator.setAttribute('d', `m0 0v${params_dynamic.y - params_static.y}`);

range_eqn.style.top = `${100*params_static.y/svg_vals.height}%`;
range_scale.style.top = `${100*params_static.y/svg_vals.height}%`;
range_zero.style.top = `${100*params_static.y/svg_vals.height}%`;

let axesGap = svg_box.clientHeight*Math.abs(params_dynamic.y - params_static.y)/100;

//Modify the values of CSS properties defined on root, which are then used to style various elements in the document
document.documentElement.style.setProperty('--h', `${axesGap}px`);
document.documentElement.style.setProperty('--t', `translateY(${axesGap/2}px)`);
document.documentElement.style.setProperty('--label-text-size', `${(params_dynamic.y - params_static.y)/12}px`);
document.documentElement.style.setProperty('--ticknumber-text-size', `${(params_dynamic.y - params_static.y)/15}px`);
if (EQUATION_COLOUR) {document.documentElement.style.setProperty('--thumb-colour', EQUATION_COLOUR)};
if (SCALE_FACTOR_COLOUR) {document.documentElement.style.setProperty('--sf-colour', SCALE_FACTOR_COLOUR);}

if(params_static.min > 0 || params_static.max < 0 || ZERO_DRAGGABLE !== true) {
    range_zero.classList.add('noshow');
} else {
    range_zero.max = (params_static.max - params_static.min)/2;
    range_zero.min = -1*range_zero.max;
    zeroPos = map_range(0, range_zero, params_static);
    range_zero.value = zeroPos;
}


//set event listeners on the equation slider
//NB: there's a difference between input.value, and the input's HTML 'value' attribute
range_eqn.addEventListener('input', event => { 
    if(scaling == false) {
        //this is to prevent  sliders from being trapped together if they are manipulated while overlapping.
        let eqn_pos = map_range(range_scale.value, range_scale, range_eqn);
        if (range_eqn.value >= eqn_pos - OVERLAP_TOLERANCE && range_eqn.value <= eqn_pos + OVERLAP_TOLERANCE) {
            range_scale.disabled = true;
            range_zero.disabled = true;
        } else {
            range_scale.disabled = false;
            range_zero.disabled = false;
        }
    }
    updateEqn();
});

//set event listener on the scale-factor slider
range_scale.addEventListener('input', event => {
    scale_factor = parseFloat(range_scale.value);
    positionLabel(label_scale, range_scale);
    updateScaleFactor(scale_factor);
    let eqn_pos = map_range(range_scale.value, range_scale, range_eqn);
    if (range_eqn.value >= eqn_pos - OVERLAP_TOLERANCE && range_eqn.value <= eqn_pos + OVERLAP_TOLERANCE) {
        positionLabel(label_scale, range_scale, true);
    }
});

//set event listener on the zero-position slider
range_zero.addEventListener('input', event => {
    if(Math.abs(range_zero.value) > 0.9*range_zero.max) {
        range_zero.value = Math.sign(range_zero.value)*0.9*range_zero.max;
    }
    translateZero(range_zero.value - zeroPos);
    zeroPos = range_zero.value;
    indicator_zero.update(map_range(0, params_static, svg_limits));
});

//initial setup based on static and dynamic parameters (primarily static 'spacing' and 0 position (params.x))
updateParams(params_static);
generateTickmarks(ticks_static, params_static);
generateAxisNumbers(ticks_static, params_static);
updateParams(params_dynamic);

const indicator_zero = new Indicator(svg_vals.x, 0, false, 'indicator_zero');
const indicator_scale = new Indicator(svg_vals.x, 0, true, 'indicator_scale');
const indicator_eqn = new Indicator(svg_vals.x, 0, true, 'indicator_eqn');

range_scale.dispatchEvent(new Event('input'));

range_eqn.value = map_range(0, params_static, svg_limits);
range_eqn.dispatchEvent(new Event('input'));

indicator_zero.y = params_static.y;
indicator_zero.update(map_range(0, params_static, svg_limits));
indicator_zero.render(svg_box);

indicator_eqn.y = params_static.y;
updateEqn();
indicator_eqn.render(svg_box);

indicator_scale.y = params_static.y;
indicator_scale.update(map_range(1, params_dynamic, svg_limits));
indicator_scale.render(svg_box);



///FUNCTIONS

//this function does all the various things that need to happen whenever the scale factor is adjusted.
function updateScaleFactor(n) {
scale_factor = n;

    if(Math.abs(scale_factor) < 0.0001*(range_scale.max - range_scale.min)) {
        scale_factor = 0;
    }

    let currentMappedValue = map_range(range_eqn.value, range_eqn, params_dynamic);
    params_dynamic.spacing = Math.abs(scale_factor)*params_static.spacing;
    
    if (scale_factor !== 0) {
    updateParams(params_dynamic);
    generateTickmarks(ticks_dynamic, params_dynamic);
    generateAxisNumbers(ticks_dynamic, params_dynamic);

    //this causes only a cosmetic change when rendering the axes - just plonks a negative sign out the front
    //gonna need to do something with the 'currentMappedValue' so that the slider tracks into the correct side of zero.
    if (scale_factor < 0) {
        if(params_dynamic.reverse == false) {
            params_dynamic.reverse = true;
            currentMappedValue *= -1;
        }
    } else {
        if(params_dynamic.reverse == true) {
            params_dynamic.reverse = false;
            currentMappedValue *= -1;
        }
    }

    
    //Update positions of UI elements. Really these could be grouped for convenience and lighter code.
}
    range_eqn.value = map_range(currentMappedValue, params_dynamic, range_eqn);
    indicator_scale.update(map_range(Math.sign(scale_factor)*1, params_dynamic, svg_limits));
    label_scale.childNodes[0].nodeValue = `Scale factor = ${roundToDP(scale_factor, dpRounding)}`;

    //This is to stop the range_scale from being disabled while dragging into over the range_eqn thumb.
    scaling = true;
    range_eqn.dispatchEvent(new Event('input'));
    scaling = false;
}

//this is used to produce the SVG axis with appropriate spacings and numbering of tick marks
function generateTickmarks (target, params) {

    let tickInfo = tickPositioning(params);

    let firstTick = tickInfo.first;
    let firstTickPos = tickInfo.firstPos;
    let n_ticks = tickInfo.n;
    let spacing = tickInfo.spacing;
    let inc = tickInfo.inc;

    //set display of existing ticks and numbers to 'none'
    //for performance reasons, it's better to do this via toggling class than manipulating .style on each element
    let ticksandnums = target.childNodes;
    let existingTicks = target.getElementsByTagName('use');
    let existingNums = target.getElementsByTagName('text');

    for (let i = 0, l = ticksandnums.length; i < l; i++) {
        ticksandnums[i].classList.add('noshow');
    }

    

    for (let i = 0; i <= n_ticks; i++) {
        let tick;
        //first see if an existing tickmark can be used
        if (existingTicks[i]) {
            tick = existingTicks[i];
            tick.classList.remove('noshow');
        } else {
            //if not, create a 'clone' of the tickmark path specified in the SVG 'defs' element
            tick = document.createElementNS(xmlns, 'use');
            tick.setAttributeNS(xlink, 'xlink:href', '#tickmark-template');
            tick.classList.add('tickmark');
            target.appendChild(tick);
        }

        tick.setAttribute('transform', `translate(${firstTickPos + i*spacing}, ${params.y})`);
    }
}

function generateAxisNumbers(target, params) {

    let tickInfo = tickPositioning(params);

    let firstTick = tickInfo.first;
    let firstTickPos = tickInfo.firstPos;
    let n_ticks = tickInfo.n;
    let spacing = tickInfo.spacing;
    let inc = tickInfo.inc;

    let existingNums = target.getElementsByTagName('text');
    let tickHeight = document.getElementsByClassName('tickmark')[0].getBBox().height;

    for (let i = 0; i <= n_ticks; i++) {

        let num;
            if (existingNums[i]) {
                num = existingNums[i];
                num.classList.remove('noshow');
            } else {
                //create SVG 'text' element for the corresponding number
                num = document.createElementNS(xmlns, 'text');
                num.setAttribute('class', 'ticknumber');
                target.appendChild(num);
                num.insertAdjacentText('beforeend', '');
            }
            let rev = 1;
            if (params.reverse == true) {rev = -1;}
            num.childNodes[0].nodeValue = `${Math.round(rev*10*(firstTick + i*inc))/10}`;
            
            
            //get bounding boxes of the tick mark and the number, to provide coordinate info
            //for vertical positioning of numbers.
            num.setAttribute('x', `${firstTickPos + i*spacing}`);
            num.setAttribute('y', `${params.y + 0.5*tickHeight}`);
            let numBounds = num.getBBox();
            num.setAttribute('transform', `translate(0, ${0.9*numBounds.height})`);
            //if the number will be rendered only partially, hide it. This is done with reference to the viewBox of
            //the surrounding SVG element.
            if (numBounds.x < svg_vals.x || numBounds.x + numBounds.width > svg_vals.x + svg_vals.width) {
                num.classList.add('noshow');
            }
    }

}

function calculateSpacing(params) {
    let spacing = params.spacing;

    //this spacing stuff is a bit hacky, and could be done better.
    //if spacing is too big, inject intermediate tick marks...
    while (spacing > svg_vals.width/5) {
        spacing = spacing/5;
    }
    //if spacing is too tight, remove tick marks
    while (spacing < svg_vals.width/20) {
        spacing = spacing*5;
    }
    return spacing;
}

function tickPositioning (params) {
    let spacing = calculateSpacing(params);
    let inc = spacing/params.spacing;

    let first = inc*Math.ceil(params.min/inc);
    let firstPos = map_range(first, params, svg_limits);
    let n = Math.floor((svg_vals.width - firstPos)/spacing);

    return {n, first, firstPos, spacing, inc};
}

//find current min and max on a scale...
function axisMinMax(originX, spacing) {
    let spacings = svg_vals.width/spacing;
    let min = (svg_vals.x - originX)/spacing;
    let max = (svg_vals.width + svg_vals.x - originX)/spacing;
    return ({min, max});
}

//dispense new min and max to params object
function updateParams(params) {
    let minmax = axisMinMax(params.x, params.spacing);
    params.min = minmax.min;
    params.max = minmax.max;
}

function positionLabel(label, range, overlap = false) {
    let label_offset = -2;
    let h = label.getBBox().height - 1;
    let val100 = map_range(range.value, range, svg_limits);


    if(overlap == true) {
        if(svg_vals.x + svg_vals.width - val100 < h) {
            label_offset -= h;
        } else if (val100 < h) {
            label_offset = 2*h;
        } else {
            label_offset = h;
        }
    } else if(val100  < h) {
            label_offset = h;
    } 
    

    label.setAttribute('transform', `translate(${val100}, ${0.5*(params_static.y + params_dynamic.y)}) rotate(270) translate(0, ${label_offset})`);
}

function updateEqn() {
    positionLabel(label_slider, range_eqn, range_scale.disabled);
    let mappedValue = map_range(range_eqn.value, range_eqn, params_dynamic);
    indicator_eqn.update(map_range(range_eqn.value, range_eqn, svg_limits));
    let sign = Math.sign(scale_factor);
    if (sign == 0) {sign = 1;}
    label_slider.childNodes[0].nodeValue = `${roundToDP(sign*mappedValue, dpRounding)} x ${roundToDP(scale_factor, dpRounding)} = ${roundToDP(roundToDP(Math.sign(scale_factor)*mappedValue, dpRounding)*roundToDP(scale_factor, dpRounding), 8)}`;
    curtailNumber(label_slider, dpRounding + 1);
}

//map a value on one range to its corresponding value on a new range
function map_value(value, min_old, max_old, min_new, max_new) {
    let p = (value - min_old)/(max_old - min_old);
    return (p*(max_new - min_new) + min_new);
}

function map_range(value, range_old, range_new) {
    let p = map_value(value, range_old.min, range_old.max, range_new.min, range_new.max);
    return p;
}

//round to a given number of decimal points
function roundToDP (value, dp) {
    return (Math.round(value * (10**dp))/10**dp);
}

//if there are many digits after the DP, replace after a given number with ...
function curtailNumber (elm, dp) {
    let str = elm.childNodes[0].nodeValue;
    let idx = str.lastIndexOf('.');
    let eq = str.indexOf('=');
    let newStr = str.slice(0, idx + dp + 1);
    if(idx > -1 && idx > eq) {
        if (newStr.length < str.length) {
            newStr+='\u2026'
            elm.childNodes[0].nodeValue = newStr;
        }
    }
}

function translateZero (inc) {
    //store current mapped values of range_eqn and range_scale so they can be re-mapped when scale moves
    let old_scale = map_range(range_scale.value, range_scale, params_static);
    let old_eqn = map_range(range_eqn.value, range_eqn, params_static);
    //change static params min and max
    params_static.min += inc;
    params_static.max += inc;
    params_static.x = map_range(0, params_static, svg_limits);
    params_dynamic.x = params_static.x;
    range_scale.setAttribute('min', `${params_static.min}`);
    range_scale.setAttribute('max', `${params_static.max}`);
    //update dynamic params min and max to suit
    //generate tickmarks for both axes
    updateParams(params_static);
    updateParams(params_dynamic);
    generateTickmarks(ticks_static, params_static);
    generateAxisNumbers(ticks_static, params_static);

    //reposition the sliders
    range_scale.value = old_scale;
    if (range_scale.value == 0) {
        console.log('help')
        range_scale.value = Math.sign(old_scale)*0.1;
    }
    range_eqn.value = map_range(old_eqn, params_static, range_eqn);
    range_scale.dispatchEvent(new Event('input'));
    
}