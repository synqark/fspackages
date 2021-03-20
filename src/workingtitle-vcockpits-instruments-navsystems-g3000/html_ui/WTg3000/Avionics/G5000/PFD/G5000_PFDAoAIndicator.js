class WT_G5000_PFDAoAIndicator extends WT_G3x5_PFDAoAIndicator {
    /**
     * @readonly
     * @property {WT_G5000_PFDAoAIndicatorHTMLElement} htmlElement
     * @type {WT_G5000_PFDAoAIndicatorHTMLElement}
     */
    get htmlElement() {
        return this._htmlElement;
    }

    _createHTMLElement() {
        let htmlElement = new WT_G5000_PFDAoAIndicatorHTMLElement();
        htmlElement.setContext({
            yellowFraction: 0.7,
            redFraction: 0.9,
            criticalAngle: 11,
            airplane: this.instrument.airplane,
            modeSetting: this.aoaModeSetting
        });
        return htmlElement;
    }

    init(root) {
        let container = root.querySelector(`#InstrumentsContainer`);
        this._htmlElement = this._createHTMLElement();
        container.appendChild(this.htmlElement);
    }

    onUpdate(deltaTime) {
        this.htmlElement.update();
    }
}

class WT_G5000_PFDAoAIndicatorHTMLElement extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({mode: "open"});
        this.shadowRoot.appendChild(WT_G5000_PFDAoAIndicatorHTMLElement.TEMPLATE.content.cloneNode(true));

        this._modeListener = this._onModeSettingChanged.bind(this);

        /**
         * @type {WT_G5000_PFDAoAIndicatorContext}
         */
        this._context = null;
        this._oldContext = null;
        this._isInit = false;

        this._mode = WT_G3x5_PFDAoAModeSetting.Mode.OFF;

        this._tempVector1 = new WT_GVector2(0, 0);
        this._tempVector2 = new WT_GVector2(0, 0);
    }

    _defineChildren() {
        this._yellowArc = this.shadowRoot.querySelector(`#yellowarc`);
        this._redArc = this.shadowRoot.querySelector(`#redarc`);
        this._ticks = this.shadowRoot.querySelectorAll(`#ticks line`);
        this._needle = this.shadowRoot.querySelector(`#needle`);
    }

    connectedCallback() {
        this._defineChildren();
        this._isInit = true;
        this._updateFromContext();
    }

    _calculateAngle(fraction) {
        let window = WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX - WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MIN;
        return -(fraction - WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MIN) / window * 180 + 180;
    }

    _selectColor(fraction) {
        if (fraction >= this._context.redFraction) {
            return WT_G5000_PFDAoAIndicatorHTMLElement.Color.RED;
        } else if (fraction >= this._context.yellowFraction) {
            return WT_G5000_PFDAoAIndicatorHTMLElement.Color.YELLOW;
        } else {
            return WT_G5000_PFDAoAIndicatorHTMLElement.Color.WHITE;
        }
    }

    _updateModeListener() {
        if (this._oldContext) {
            this._oldContext.modeSetting.removeListener(this._modeListener);
        }

        if (this._context) {
            this._context.modeSetting.addListener(this._modeListener);
        }
    }

    _updateArc(arc, startFraction, endFraction) {
        let startAngle = Math.max(0, Math.min(180, this._calculateAngle(startFraction))) * Avionics.Utils.DEG2RAD;
        let endAngle = Math.max(0, Math.min(180, this._calculateAngle(endFraction))) * Avionics.Utils.DEG2RAD;

        let start = this._tempVector1.setFromPolar(45, startAngle).add(50, 50);
        let end = this._tempVector2.setFromPolar(45, endAngle).add(50, 50);

        arc.setAttribute("d", `M ${start.x} ${start.y} A 45 45 0 0 0 ${end.x} ${end.y}`);
    }

    _updateYellowArc() {
        this._updateArc(this._yellowArc, this._context ? this._context.yellowFraction : WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX, this._context ? this._context.redFraction : WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX);
    }

    _updateRedArc() {
        this._updateArc(this._redArc, this._context ? this._context.redFraction : WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX, WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX);
    }

    _updateTicks() {
        this._ticks.forEach(tick => {
            let fraction = parseFloat(tick.getAttribute("fraction"));
            tick.setAttribute("color", this._selectColor(fraction));
        });
    }

    _updateFromContext() {
        this._updateModeListener();
        this._updateMode();
        this._updateYellowArc();
        this._updateRedArc();
        this._updateTicks();
    }

    /**
     *
     * @param {WT_G5000_PFDAoAIndicatorContext} context
     */
    setContext(context) {
        if (this._context === context) {
            return;
        }

        this._oldContext = this._context;
        this._context = context;

        if (this._isInit) {
            this._updateFromContext();
        }
    }

    _rotateNeedle(fraction) {
        let angle = this._calculateAngle(fraction);
        this._needle.setAttribute("transform", `rotate(${Math.max(0, Math.min(180, angle))} 50 50)`);
    }

    _setNeedleColor(fraction) {
        this._needle.setAttribute("color", this._selectColor(fraction));
    }

    _updateNeedle() {
        let aoa = this._context.airplane.dynamics.aoa();
        let fraction = aoa / this._context.criticalAngle;
        this._rotateNeedle(fraction);
        this._setNeedleColor(fraction);
    }

    update() {
        if (!this._isInit || !this._context) {
            return;
        }

        this._updateNeedle();
    }

    _updateMode() {
        let mode = this._context ? this._context.modeSetting.getValue() : WT_G3x5_PFDAoAModeSetting.Mode.OFF;
        if (mode === this._mode) {
            return;
        }

        this.setAttribute("show", `${mode !== WT_G3x5_PFDAoAModeSetting.Mode.OFF}`);
        this._mode = mode;
    }

    _onModeSettingChanged(setting, newValue, oldValue) {
        this._updateMode();
    }
}
/**
 * @enum {String}
 */
WT_G5000_PFDAoAIndicatorHTMLElement.Color = {
    WHITE: "white",
    YELLOW: "yellow",
    RED: "red"
};
WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MIN = 0.2;
WT_G5000_PFDAoAIndicatorHTMLElement.SCALE_MAX = 1;
WT_G5000_PFDAoAIndicatorHTMLElement.NAME = "wt-pfd-aoaindicator";
WT_G5000_PFDAoAIndicatorHTMLElement.TEMPLATE = document.createElement("template");
WT_G5000_PFDAoAIndicatorHTMLElement.TEMPLATE.innerHTML = `
    <style>
        :host {
            display: none;
            background-color: var(--wt-g3x5-bggray);
            border-radius: 5px;
        }
        :host([show="true"]) {
            display: block;
        }

        #wrapper {
            position: absolute;
            left: var(--aoaindicator-margin-left, 0.1em);
            top: var(--aoaindicator-margin-top, 0.1em);
            width: calc(100% - var(--aoaindicator-margin-left, 0.1em) - var(--aoaindicator-margin-right, 0.1em));
            height: calc(100% - var(--aoaindicator-margin-top, 0.1em) - var(--aoaindicator-margin-bottom, 0.1em));
        }
            #gauge {
                position: absolute;
                left: 0%;
                top: 0%;
                width: 100%;
                height: 100%;
            }
                svg {
                    width: 100%;
                    height: 100%;
                }
                    .arc {
                        stroke-width: 4;
                        fill: transparent;
                    }
                    #whitearc {
                        stroke: white;
                    }
                    #yellowarc {
                        stroke: var(--wt-g3x5-amber);
                    }
                    #redarc {
                        stroke: red;
                    }
                    #ticks {
                        stroke-width: 3;
                        fill: transparent;
                    }
                        #ticks line {
                            stroke: white;
                        }
                        #ticks line[color="yellow"] {
                            stroke: var(--wt-g3x5-amber);
                        }
                        #ticks line[color="red"] {
                            stroke: red;
                        }
                    #labels {
                        fill: white;
                        font-size: var(--aoaindicator-label-font-size, 0.95em);
                    }
                    #needle {
                        stroke: black;
                        stroke-width: 1;
                        fill: white;
                    }
                    #needle[color="yellow"] {
                        fill: var(--wt-g3x5-amber);
                    }
                    #needle[color="red"] {
                        fill: red;
                    }
            #title {
                position: absolute;
                left: 0%;
                top: 40%;
                transform: translateY(-50%);
            }
    </style>
    <div id="wrapper">
        <div id="gauge">
            <svg viewBox="0 0 100 100">
                <path id="whitearc" class="arc" d="M 50 95 A 45 45 0 0 0 50 5"></path>
                <path id="yellowarc" class="arc" d=""></path>
                <path id="redarc" class="arc" d=""></path>
                <g id="ticks">
                    <line fraction="0.2" x1="50" y1="97" x2="50" y2="85" transform="rotate(0 50 50)" />
                    <line fraction="0.4" x1="50" y1="95" x2="50" y2="85" transform="rotate(-45 50 50)" />
                    <line fraction="0.6" x1="50" y1="95" x2="50" y2="85" transform="rotate(-90 50 50)" />
                    <line fraction="0.8" x1="50" y1="95" x2="50" y2="85" transform="rotate(-135 50 50)" />
                    <line fraction="1" x1="50" y1="97" x2="50" y2="85" transform="rotate(-180 50 50)" />
                </g>
                <g id="labels">
                    <text x="50" y="80" text-anchor="middle" alignment-baseline="text-bottom">.2</text>
                    <text x="80" y="50" text-anchor="end" alignment-baseline="middle">.6</text>
                    <text x="50" y="20" text-anchor="middle" alignment-baseline="hanging">1.0</text>
                </g>
                <path id="needle" d="M 50 50 C 45 40 45 40 50 5 C 55 40 55 40 50 50"></path>
            </svg>
        </div>
        <div id="title">AOA</div>
    </div>
`;

customElements.define(WT_G5000_PFDAoAIndicatorHTMLElement.NAME, WT_G5000_PFDAoAIndicatorHTMLElement);

/**
 * @typedef WT_G5000_PFDAoAIndicatorContext
 * @property {{min:Number, max:Number, majorTick:Number, minorTickFactor:Number, majorTickLength:Number, minorTickLength:Number, labelFontSize:Number}} scale
 * @property {Number} yellowFraction
 * @property {Number} redFraction
 * @property {Number} criticalAngle
 * @property {WT_PlayerAirplane} airplane
 * @property {WT_G3x5_PFDAoAModeSetting} modeSetting
 */