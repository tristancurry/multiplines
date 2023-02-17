function Indicator (posX=0, posY=0, arrow=false, className) {
    this.x = posX;
    this.y = posY;

    this.elm = document.createElementNS(xmlns, 'use');
    this.elm.setAttributeNS(xlink, 'xlink:href', '#indicator');
    if(arrow == true) {
        this.arrow = document.createElementNS(xmlns, 'use');
        this.arrow.setAttributeNS(xlink, 'xlink:href', '#arrowhead');
    }

    if (className) {
        this.elm.setAttribute('class', className);
        if(this.arrow) {
            this.arrow.setAttribute('class', className);
        }
    }
    return this;
}

Indicator.prototype.update = function (posX) {
    //update position
    this.elm.setAttribute('transform', `translate(${posX}, ${this.y})`);
    if(this.arrow) {
        this.arrow.setAttribute('transform', `translate(${posX}, ${this.y})`);
    }
}

Indicator.prototype.render = function (target) {
    target.prepend(this.elm);
    if(this.arrow) {
        target.prepend(this.arrow);
    }
}

Indicator.associateLabel = function (label_elm) {
    this.label = label_elm;
}