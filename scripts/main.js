let factor = 1;
let divide = false; 
const dpRounding = 1;

const xmlns = 'http://www.w3.org/2000/svg';
const xlink = 'http://www.w3.org/1999/xlink';

//give all relevant HTML/SVG elements a reference
//there's probably some packaging into arrays and/or generation in JS that
//could make this less wordy.
const numberlines = document.getElementById('numberlines');
const svg_box = document.getElementsByTagName('svg')[0];

let svg_vals = svg_box.viewBox.baseVal;

const indicator = document.getElementById('indicator'); //this one is the template for all indicators

const indicator_zero = new Indicator(0, false, 'indicator_zero');
const indicator_one = new Indicator(0, true, 'indicator_one');
const indicator_slider = new Indicator(0, true, 'indicator_slider');

const svg_static = document.getElementById('svg_static');
const axis_static = document.getElementById('axis_static');
const ticks_static = svg_static.getElementsByClassName('tickmarks')[0];
const nl_static = document.getElementById('nl_static');

const svg_dynamic = document.getElementById('svg_dynamic');
const axis_dynamic = document.getElementById('axis_dynamic');
const ticks_dynamic = svg_dynamic.getElementsByClassName('tickmarks')[0];
const nl_dynamic = document.getElementById('nl_dynamic');

const label_scale = document.getElementById('label_scale');
const label_slider = document.getElementById('label_slider');
const label_group = document.getElementById('labels');


const sf = document.getElementById('sf');
sf.value = factor;
   
const params_static = {min:-1, max:11, x:50, y:25, spacing:9, reverse:false};
const params_dynamic = {x:50, y:70, reverse:false};

//now make sure the axes, input ranges and indicators are visually aligned to these params...
axis_static.setAttribute('d', `m-25 ${params_static.y}h150`);
axis_dynamic.setAttribute('d', `m-25 ${params_dynamic.y}h150`);

nl_static.style.top = `${params_static.y}%`;
nl_dynamic.style.top = `${params_dynamic.y}%`;

let axesGap = svg_box.clientHeight*Math.abs(params_dynamic.y - params_static.y)/100;
nl_static.style.setProperty('--h', `${axesGap/2}px`);
nl_dynamic.style.setProperty('--h', `${axesGap/2}px`);
nl_static.style.setProperty('--t', `translateY(${axesGap/4}px)`);
nl_dynamic.style.setProperty('--t', `translateY(${-1*axesGap/4}px)`);


indicator.setAttribute('d', `m0 0v${params_dynamic.y - params_static.y}`);

//set event listeners on the two sliders
//if there were more sliders to synchronise, a loop over the input elements
//in the containing div would be a good way to set these up.
//NB: there's a difference between input.value, and the input's HTML 'value' attribute
nl_static.addEventListener('input', event => {
    if (nl_static.value > 99) {nl_static.value = 99;} else
    if (nl_static.value < 1) {nl_static.value = 1;} 
    nl_dynamic.value = nl_static.value;
    updateSlider();
});

nl_dynamic.addEventListener('input', event => {
    if (nl_dynamic.value > 99) {nl_dynamic.value = 99;} else
    if (nl_dynamic.value < 1) {nl_dynamic.value = 1;} 
    nl_static.value = nl_dynamic.value;
    updateSlider();
});

//set event listener on the scale-factor slider
sf.addEventListener('input', event => {
    factor = parseFloat(sf.value);
    updateScaleFactor(factor);
});


//initial setup based on static and dynamic parameters (primarily static 'spacing' and 0 position (origin.x))
updateParams(params_static);
generateTickmarks(ticks_static, params_static);

updateParams(params_dynamic);
updateScaleFactor(factor);

nl_static.value = map_value(0, params_static.min, params_static.max, 0, 100);
nl_static.dispatchEvent(new Event('input'));

indicator_zero.y = params_static.y;
indicator_zero.update(map_value(0, params_static.min, params_static.max, 0, 100));
indicator_zero.render(svg_box);

indicator_one.y = params_static.y;
indicator_one.update(map_value(1, params_dynamic.min, params_dynamic.max, 0, 100));
indicator_one.render(svg_box);

indicator_slider.y = params_static.y;
indicator_slider.update(nl_dynamic.value);
indicator_slider.render(svg_box);


///FUNCTIONS

//this function does all the various things that need to happen whenever the scale factor is adjusted.
function updateScaleFactor(n) {
factor = n;

//this is clumsy - should just refuse to do anything that would require dividing by zero instead.
    if(factor == 0) {
        factor = 0.1;
    }

    let currentMappedValue = map_value(nl_dynamic.value, 0, 100, params_dynamic.min, params_dynamic.max);
    params_dynamic.spacing = Math.abs(factor)*params_static.spacing;
    updateParams(params_dynamic);
    generateTickmarks(ticks_dynamic, params_dynamic);

    //this causes only a cosmetic change when rendering the axes - just plonks a negative sign out the front
    //gonna need to do something with the 'currentMappedValue' so that the slider tracks into the correct side of zero.
    if (factor < 0) {
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

    nl_dynamic.value = map_value(currentMappedValue, params_dynamic.min, params_dynamic.max, 0, 100);

    //Update positions of UI elements. Really these could be grouped for convenience and lighter code.
    indicator_one.update(map_value(Math.sign(factor)*1, params_dynamic.min, params_dynamic.max, 0, 100));

    label_scale.setAttribute('transform', `translate(${map_value(Math.sign(factor)*1, params_dynamic.min, params_dynamic.max, 0, 100)},${0.5*(params_static.y + params_dynamic.y)}) rotate(90) translate(0, -1)`);
    label_scale.childNodes[0].nodeValue = `Scale factor = ${roundToDP(factor, dpRounding)}`;

    if(!divide) {
        nl_dynamic.dispatchEvent(new Event('input'));
    } else {
        nl_static.dispatchEvent(new Event('input'));
    }
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
while (spacing < 5) {
    spacing = spacing*5;
    inc = inc*5;
}

let firstTick = inc*Math.ceil(params.min/inc);
let firstTickPos = map_value(firstTick, params.min, params.max, 0, 100);
let n_ticks = Math.floor((100 - firstTickPos)/spacing);


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
    num.setAttribute('transform', `translate(0, ${0.85*numBounds.height})`);
    //if the number will be rendered only partially, hide it. This is done with reference to the viewBox of
    //the surrounding SVG element.
    if (numBounds.x < svg_vals.x || numBounds.x + numBounds.width > svg_vals.x + svg_vals.width) {
        num.style.display = 'none';
    }
}
}


//find current min and max on a scale...
function axisMinMax(originX, spacing) {
    let spacings = 100/spacing;
    let min = (0 - originX)/spacing;
    let max = (100 - originX)/spacing;
    return ({min, max});
}

//dispense new min and max to params object
function updateParams(params) {
    let minmax = axisMinMax(params.x, params.spacing);
    params.min = minmax.min;
    params.max = minmax.max;
}

function updateSlider() {
    let label_offset = -1;
    let h = label_slider.getBBox().height;
    if(100 - nl_dynamic.value  < h) {
        label_offset= h;
    }
    let mappedValue = map_value(nl_dynamic.value, 0, 100, params_dynamic.min, params_dynamic.max);
    indicator_slider.update(nl_dynamic.value);
    label_slider.setAttribute('transform', `translate(${nl_dynamic.value}, ${0.5*(params_static.y + params_dynamic.y)}) rotate(90) translate(0, ${label_offset})`);
    label_slider.childNodes[0].nodeValue = `${roundToDP(Math.sign(factor)*mappedValue, dpRounding)} x ${roundToDP(factor, dpRounding)} = ${roundToDP(Math.sign(factor)*mappedValue, dpRounding)*roundToDP(factor, dpRounding)}`;
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