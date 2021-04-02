class WT_G5000_TCASII extends WT_G3x5_TrafficSystem {
    constructor(airplane, trafficTracker, xpdrID, options) {
        super(airplane, trafficTracker, options);

        this._xpdrID = xpdrID;
        this._initXPDRSettingModel();
    }

    /**
     * @returns {WT_G5000_TrafficSystemSensitivity}
     */
    _createSensitivity() {
        return new WT_G5000_TCASIISensitivity(this._airplane);
    }

    _initOptionsManager() {
        super._initOptionsManager();

        this._optsManager.addOptions(WT_G5000_TCASII.OPTION_DEFS);
    }

    _initSettingModel() {
        this._settingModel = new WT_DataStoreSettingModel(WT_G3x5_TrafficSystem.ID);

        this._operatingModeSetting = new WT_G5000_TrafficSystemOperatingModeSetting(this._settingModel);
        this._settingModel.addSetting(this._operatingModeSetting);

        this._operatingModeSetting.addListener(this._onOperatingModeSettingChanged.bind(this));

        this._settingModel.init();
    }

    _initXPDRSettingModel() {
        this._xpdrSettingModel = new WT_DataStoreSettingModel(this._xpdrID);

        let xpdrModeSetting = new WT_G5000_TransponderModeSetting(this._xpdrSettingModel);
        this._xpdrSettingModel.addSetting(xpdrModeSetting);

        xpdrModeSetting.addListener(this._onXPDRModeSettingChanged.bind(this));
        this._updateFromXPDRMode(xpdrModeSetting.getValue());
    }

    onOptionChanged(option, oldValue, newValue) {
        switch (option) {
            case "proximityAdvisoryParams":
                this._entryUpdateOptions[option] = newValue;
                break;
        }
    }

    _onOperatingModeSettingChanged(setting, newValue, oldValue) {
        this._setOperatingMode(newValue);
    }

    _onXPDRModeSettingChanged(setting, newValue, oldValue) {
        this._updateFromXPDRMode(newValue);
    }

    _updateFromXPDRMode(xpdrMode) {
        let operatingMode;
        switch (xpdrMode) {
            case WT_G5000_TransponderModeSetting.Mode.AUTO:
                // shouldn't be possible to get here, but just in case we will fall through to TA Only mode.
            case WT_G5000_TransponderModeSetting.Mode.TA_ONLY:
                operatingMode = WT_G5000_TCASII.OperatingMode.TA_ONLY;
                break;
            default:
                operatingMode = WT_G5000_TCASII.OperatingMode.STANDBY;
        }
        this._operatingModeSetting.setValue(operatingMode);
    }

    _createIntruderEntry(intruder) {
        return new WT_G5000_TCASIIIntruderEntry(intruder);
    }

    _doUpdate(currentTime) {
        if (this.operatingMode === WT_G5000_TCASII.OperatingMode.STANDBY) {
            this._clearEntriesCulled();
            return;
        }

        this._updateSensitivity();

        super._doUpdate(currentTime);
    }
}
WT_G5000_TCASII.OPTION_DEFS = {
    proximityAdvisoryParams: {default: {
        horizontalSeparation: WT_Unit.NMILE.createNumber(6),
        verticalSeparation: WT_Unit.FOOT.createNumber(1200)
    }, auto: true, observed: true}
};
/**
 * @enum {Number}
 */
WT_G5000_TCASII.OperatingMode = {
    STANDBY: 0,
    TA_RA: 1,
    TA_ONLY: 2
};
/**
 * @enum {Number}
 */
WT_G5000_TCASII.AlertLevel = {
    UNKNOWN: 0,
    NON_THREAT: 1,
    PROXIMITY_ADVISORY: 2,
    TRAFFIC_ADVISORY: 3,
    RESOLUTION_ADVISORY: 4
}

/**
 * @typedef WT_G5000_TCASIIIntruderEntryUpdateOptions
 * @property {WT_G5000_TCASII.OperatingMode} operatingMode
 * @property {{horizontalSeparation:WT_NumberUnit, verticalSeparation:WT_NumberUnit}} proximityAdvisoryParams
 */

class WT_G5000_TCASIISensitivity extends WT_G3x5_TrafficSystemSensitivity {
    /**
     * @param {WT_PlayerAirplane} airplane
     */
    constructor(airplane) {
        super(airplane, WT_G5000_TCASIISensitivity.LOOKAHEAD_TIMES, WT_G5000_TCASIISensitivity.PROTECTED_RADII, WT_G5000_TCASIISensitivity.PROTECTED_HEIGHTS)

        this._tempFeet = WT_Unit.FOOT.createNumber(0);
    }

    update() {
        let radarAltitudeFeet = this._airplane.sensors.radarAltitude(this._tempFeet).number;
        let trueAltitudeFeet = this._airplane.navigation.altitude(this._tempFeet).number;
        if (radarAltitudeFeet > 2350) {
            if (trueAltitudeFeet > 42000) {
                this._level = 6;
            } else if (trueAltitudeFeet > 20000) {
                this._level = 5;
            } else if (trueAltitudeFeet > 10000) {
                this._level = 4;
            } else if (trueAltitudeFeet > 5000) {
                this._level = 3;
            } else {
                this._level = 2;
            }
        } else if (radarAltitudeFeet > 1000) {
            this._level = 1;
        } else {
            this._level = 0;
        }
    }
}
WT_G5000_TCASIISensitivity.LOOKAHEAD_TIMES =     [20,     25,     30,     40,     45,     48,     48].map(value => WT_Unit.SECOND.createNumber(value));
WT_G5000_TCASIISensitivity.PROTECTED_RADII =     [0.20,   0.20,   0.35,   0.55,   0.80,   1.10,   1.10].map(value => WT_Unit.NMILE.createNumber(value));
WT_G5000_TCASIISensitivity.PROTECTED_HEIGHTS =   [1700,   1700,   1700,   1700,   1700,   1700,   2400].map(value => WT_Unit.FOOT.createNumber(value));

class WT_G5000_TCASIIIntruderEntry extends WT_G3x5_TrafficSystemIntruderEntry {
    /**
     * @param {WT_G3x5_TrafficSystemIntruderEntry} intruder
     */
    constructor(intruder) {
        super(intruder);

        this._alertLevel = WT_G5000_TCASII.AlertLevel.UNKNOWN;
        this._lastHorizontalSeparation = WT_Unit.NMILE.createNumber(0);
        this._lastVerticalSeparation = WT_Unit.FOOT.createNumber(0);
    }

    /**
     * @readonly
     * @type {WT_G5000_TCASII.AlertLevel}
     */
    get alertLevel() {
        return this._alertLevel;
    }

    /**
     *
     * @param {WT_G5000_TCASIIIntruderEntryUpdateOptions} options
     */
    _updateAlertLevel(options) {
        if (!this.intruder.isPredictionValid) {
            this._alertLevel = WT_G5000_TCASII.AlertLevel.UNKNOWN;
            return;
        }

        this.intruder.predictSeparation(this.intruder.lastUpdatedTime, this._lastHorizontalSeparation, this._lastVerticalSeparation);
        if (this.intruder.tcaNorm <= 1) {
            this._alertLevel = WT_G5000_TCASII.AlertLevel.TRAFFIC_ADVISORY;
        } else {
            if (this._lastHorizontalSeparation.compare(options.proximityAdvisoryParams.horizontalSeparation) <= 0 && this._lastVerticalSeparation.compare(options.proximityAdvisoryParams.verticalSeparation) <= 0) {
                this._alertLevel = WT_G5000_TCASII.AlertLevel.PROXIMITY_ADVISORY;
            } else {
                this._alertLevel = WT_G5000_TCASII.AlertLevel.NON_THREAT;
            }
        }
    }

    /**
     *
     * @param {WT_G5000_TCASIIIntruderEntryUpdateOptions} options
     */
    update(options) {
        this._updateAlertLevel(options);
    }
}

class WT_G5000_TrafficSystemOperatingModeSetting extends WT_G3x5_TrafficSystemOperatingModeSetting {
    /**
     *
     * @param {WT_DataStoreSettingModel} model
     * @param {WT_G5000_TCASII.OperatingMode} [defaultValue]
     */
    constructor(model, defaultValue = WT_G5000_TrafficSystemOperatingModeSetting.DEFAULT) {
        super(model, defaultValue, false);
    }
}
WT_G5000_TrafficSystemOperatingModeSetting.DEFAULT = WT_G5000_TCASII.OperatingMode.STANDBY;