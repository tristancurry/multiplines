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
const svg_box = document.getElementsByTagName('svg')[0];

//at some point around here need to bundle some of these things into a function
//set the viewBox units to match the aspect ratio set in config.js
if(ASPECT_RATIO) {
    svg_box.setAttribute('viewBox', `0 0 ${ASPECT_RATIO*100} 100`);
} else {
    svg_box.setAttribute('viewBox', `0 0 1770 100`);
}

let svg_vals = svg_box.viewBox.baseVal;

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

//from here there's a bunch of geometry and layout things.
//TODO: bundle into a 'refresh' function that can be called if the geometry needs to be changed dynamically
const params_static = {min:STATIC_AXIS_MIN, max:STATIC_AXIS_MAX, x:map_value(0, STATIC_AXIS_MIN, STATIC_AXIS_MAX, svg_vals.x, svg_vals.x + svg_vals.width), y:svg_vals.y + 2*TICKMARK_HEIGHT, spacing:svg_vals.width/(STATIC_AXIS_MAX - STATIC_AXIS_MIN), reverse:false};
const params_dynamic = {x:params_static.x, y:svg_vals.y + svg_vals.height - 2*TICKMARK_HEIGHT, reverse:false};
range_scale.setAttribute('min', `${params_static.min}`);
range_scale.setAttribute('max', `${params_static.max}`);


//now make sure the axes, input ranges and indicators are visually aligned to these params...
axis_static.setAttribute('d', `m${svg_vals.x} ${params_static.y}h${svg_vals.width}`);
axis_dynamic.setAttribute('d', `m${svg_vals.x} ${params_dynamic.y}h${svg_vals.width}`);
indicator.setAttribute('d', `m0 0v${params_dynamic.y - params_static.y}`);

range_eqn.style.top = `${100*params_static.y/svg_vals.height}%`;
range_scale.style.top = `${100*params_static.y/svg_vals.height}%`;

let axesGap = svg_box.clientHeight*Math.abs(params_dynamic.y - params_static.y)/100;

//Modify the values of CSS properties defined on root, which are then used to style various elements in the document
document.documentElement.style.setProperty('--h', `${axesGap}px`);
document.documentElement.style.setProperty('--t', `translateY(${axesGap/2}px)`);
document.documentElement.style.setProperty('--label-text-size', `${(params_dynamic.y - params_static.y)/12}px`);
document.documentElement.style.setProperty('--ticknumber-text-size', `${(params_dynamic.y - params_static.y)/15}px`);
if (EQUATION_COLOUR) {document.documentElement.style.setProperty('--thumb-colour', EQUATION_COLOUR)};
if (SCALE_FACTOR_COLOUR) {document.documentElement.style.setProperty('--sf-colour', SCALE_FACTOR_COLOUR);}


//set event listeners on the equation slider
//NB: there's a difference between input.value, and the input's HTML 'value' attribute
range_eqn.addEventListener('input', event => { 
    if(scaling == false) {
        //this is to prevent both sliders from being trapped together if they are manipulated while overlapping.
        let r100 = map_value(range_scale.value, range_scale.min, range_scale.max, 0, 100);
        if (range_eqn.value >= r100 - OVERLAP_TOLERANCE && range_eqn.value <= r100 + OVERLAP_TOLERANCE) {
            range_scale.disabled = true;
        } else {
            range_scale.disabled = false;
        }
    }
    updateSlider();
});

//set event listener on the scale-factor slider
range_scale.addEventListener('input', event => {
    scale_factor = parseFloat(range_scale.value);
    positionLabel(label_scale, range_scale);
    updateScaleFactor(scale_factor);
    let r100 = map_value(range_scale.value, range_scale.min, range_scale.max, 0, 100);
    if (range_eqn.value >= r100 - OVERLAP_TOLERANCE && range_eqn.value <= r100 + OVERLAP_TOLERANCE) {
        positionLabel(label_scale, range_scale, true);
    }
});

//set event listener on the zero-position slider
range_zero.addEventListener('input', event => {
    translateZero(range_zero.value - zeroPos);
    zeroPos = range_zero.value;
});


//initial setup based on static and dynamic parameters (primarily static 'spacing' and 0 position (origin.x))
updateParams(params_static);
generateTickmarks(ticks_static, params_static);
updateParams(params_dynamic);


const indicator_zero = new Indicator(svg_vals.x, 0, false, 'indicator_zero');
const indicator_one = new Indicator(svg_vals.x, 0, true, 'indicator_one');
const indicator_slider = new Indicator(svg_vals.x, 0, true, 'indicator_slider');

range_scale.dispatchEvent(new Event('input'));

range_eqn.value = map_value(0, params_static.min, params_static.max, svg_vals.x, svg_vals.x + svg_vals.width);
range_eqn.dispatchEvent(new Event('input'));

indicator_zero.y = params_static.y;
indicator_zero.update(map_value(0, params_static.min, params_static.max, svg_vals.x, svg_vals.x + svg_vals.width));
indicator_zero.render(svg_box);

indicator_slider.y = params_static.y;
updateSlider();
indicator_slider.render(svg_box);

indicator_one.y = params_static.y;
indicator_one.update(map_value(1, params_dynamic.min, params_dynamic.max, svg_vals.x, svg_vals.x + svg_vals.width));
indicator_one.render(svg_box);



///FUNCTIONS

//this function does all the various things that need to happen whenever the scale factor is adjusted.
function updateScaleFactor(n) {
scale_factor = n;

//this is clumsy - should just refuse to do anything that would require dividing by zero instead.
    if(scale_factor == 0) {
        scale_factor = 0.1;
        label_scale.setAttribute('y', -1);
    } else {
        label_scale.setAttribute('y', 0);
    }

    let currentMappedValue = map_value(range_eqn.value, 0, 100, params_dynamic.min, params_dynamic.max);
    params_dynamic.spacing = Math.abs(scale_factor)*params_static.spacing;
    updateParams(params_dynamic);
    generateTickmarks(ticks_dynamic, params_dynamic);

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

    range_eqn.value = map_value(currentMappedValue, params_dynamic.min, params_dynamic.max, 0, 100);

    //Update positions of UI elements. Really these could be grouped for convenience and lighter code.
    indicator_one.update(map_value(Math.sign(scale_factor)*1, params_dynamic.min, params_dynamic.max, svg_vals.x, svg_vals.x + svg_vals.width));
    label_scale.childNodes[0].nodeValue = `Scale factor = ${roundToDP(scale_factor, dpRounding)}`;

    //This is to stop the range_scale from being disabled while dragging into over the range_eqn thumb.
    scaling = true;
    range_eqn.dispatchEvent(new Event('input'));
    scaling = false;
}

//this is used to produce the SVG axis with appropriate spacings and numbering of tick marks
function generateTickmarks (target, params) {

    //remove existing tickmarks and numbers
    while (target.firstChild) {
        target.firstChild.remove();
    }

    let inc = 1;
    let spacing = params.spacing;

    //this spacing stuff is a bit hacky, and could be done better.
    //if spacing is too big, inject intermediate tick marks...
    while (spacing > 45) {
        spacing = spacing/5;
        inc = inc/5;
    }
    //if spacing is too tight, remove tick marks
    while (spacing < 6) {
        spacing = spacing*5;
        inc = inc*5;
    }

    let firstTick = inc*Math.ceil(params.min/inc);
    let firstTickPos = map_value(firstTick, params.min, params.max, svg_vals.x, svg_vals.x + svg_vals.width);
    let n_ticks = Math.floor((svg_vals.width - firstTickPos)/spacing);


    for (let i = 0; i <= n_ticks; i++) {

        //create a 'clone' of the tickmark path specified in the SVG 'defs' element
        let tick = document.createElementNS(xmlns, 'use');
        tick.setAttribute('transform', `translate(${firstTickPos + i*spacing}, ${params.y})`);
        tick.setAttributeNS(xlink, 'xlink:href', '#tickmark');
        target.appendChild(tick);

        //create SVG 'text' element for the corresponding number
        let num = document.createElementNS(xmlns, 'text');
        let rev = 1;
        if (params.reverse == true) {rev = -1;}
        num.setAttribute('class', 'ticknumber');
        num.insertAdjacentText('beforeend', `${Math.round(rev*10*(firstTick + i*inc))/10}`);
        target.appendChild(num);
        
        
        //get bounding boxes of the tick mark and the number, to provide coordinate info
        //for vertical positioning of numbers.
        let tickBounds = tick.getBBox();
        num.setAttribute('x', `${firstTickPos + i*spacing}`);
        num.setAttribute('y', `${params.y + 0.5*tickBounds.height}`);
        let numBounds = num.getBBox();
        num.setAttribute('transform', `translate(0, ${0.9*numBounds.height})`);
        //if the number will be rendered only partially, hide it. This is done with reference to the viewBox of
        //the surrounding SVG element.
        if (numBounds.x < svg_vals.x || numBounds.x + numBounds.width > svg_vals.x + svg_vals.width) {
            num.style.display = 'none';
        }
    }
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
    let label_offset = -1;
    let h = label.getBBox().height;
    let val100 = map_value(range.value, range.min, range.max, svg_vals.x, svg_vals.x + svg_vals.width);


    if(overlap == true) {
        if(svg_vals.x + svg_vals.width - val100 < h) {
            label_offset = 2*h;
        } else if (val100 < h) {
            label_offset -=h;
        } else {
            label_offset = h;
        }
    } else if(svg_vals.x + svg_vals.width - val100  < h) {
            label_offset = h;
    } 
    

    label.setAttribute('transform', `translate(${val100}, ${0.5*(params_static.y + params_dynamic.y)}) rotate(90) translate(0, ${label_offset})`);
}

function updateSlider() {
    positionLabel(label_slider, range_eqn, range_scale.disabled);
    let mappedValue = map_value(range_eqn.value, 0, 100, params_dynamic.min, params_dynamic.max);
    indicator_slider.update(map_value(range_eqn.value, 0, 100, svg_vals.x, svg_vals.x + svg_vals.width));
    label_slider.childNodes[0].nodeValue = `${roundToDP(Math.sign(scale_factor)*mappedValue, dpRounding)} x ${roundToDP(scale_factor, dpRounding)} = ${roundToDP(roundToDP(Math.sign(scale_factor)*mappedValue, dpRounding)*roundToDP(scale_factor, dpRounding), 8)}`;
    curtailNumber(label_slider, dpRounding + 1);
}

//map a value on one range to its corresponding value on a new range
function map_value(value, min_old, max_old, min_new, max_new) {
    let p = (value - min_old)/(max_old - min_old);
    return (p*(max_new - min_new) + min_new);
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
    let old_scale = map_value(range_scale.value, range_scale.min, range_scale.max, params_static.min, params_static.max);
    let old_eqn = map_value(range_eqn.value, 0, 100, params_static.min, params_static.max);
    //change static params min and max
    params_static.min += inc;
    params_static.max += inc;
    params_static.x = map_value(0, params_static.min, params_static.max, svg_vals.x, svg_vals.x + svg_vals.width);
    params_dynamic.x = params_static.x;
    range_scale.setAttribute('min', `${params_static.min}`);
    range_scale.setAttribute('max', `${params_static.max}`);
    //update dynamic params min and max to suit
    //generate tickmarks for both axes
    updateParams(params_static);
    updateParams(params_dynamic);
    generateTickmarks(ticks_static, params_static);
    generateTickmarks(ticks_dynamic, params_dynamic);
    //reposition the sliders
    range_scale.value = old_scale;
    if (range_scale.value == 0) {
        range_scale.value = Math.sign(old_scale)*0.1;
    }
    range_eqn.value = map_value(old_eqn, params_static.min, params_static.max, 0, 100);
    range_scale.dispatchEvent(new Event('input'));
    

}