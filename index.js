import { extension_settings, getContext } from '../../../extensions.js';
import { saveChatDebounced, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

/**
 * Settings object containing nickname mappings.
 *
 * @typedef {Object} NicknameSettings
 * @property {Object} mappings - Collection of mappings between characters/personas and nicknames
 * @property {{[charKey: string]: { personas: {[personaKey: string]: string}}}} mappings.char - Mapping of character keys to persona nicknames.
 * @property {Object} mappings.global - Global mappings for personas and characters
 * @property {{[personaKey: string]: string}} mappings.global.personas - Mapping of persona keys to a character nickname.
 * @property {{[charKey: string]: string}} mappings.global.chars - Mapping of character keys to a persona nickname.
 */

/** @type {NicknameSettings} */
let settings = {
    mappings: {
        char: {},
        global: {
            personas: {},
            chars: {},
        },
    },
};

async function loadSettings() {
    const loadedSettings = extension_settings[SETTNGS_NAME];
    if (!loadedSettings) {
        return;
    }

    // Make sure all required objects exist
    loadedSettings.mappings ??= settings.mappings;
    loadedSettings.mappings.char ??= settings.mappings.char;
    loadedSettings.mappings.global ??= settings.mappings.global;
    loadedSettings.mappings.global.personas ??= settings.mappings.global.personas;
    loadedSettings.mappings.global.chars ??= settings.mappings.global.chars;

    settings = loadedSettings;
}

function getPersonaKey() {
    return user_avatar;
}

function getCharKey() {
    return getContext().characters[getContext().characterId]?.avatar;
}

function getUserNickname() {
    return handleNickname('user');
}

function getCharNickname() {
    return handleNickname('char');
}

/**
 * Handles nickname settings for the given type, in the given context.
 *
 * @param {'user'|'char'} type - Type of nickname to handle. Can be either 'user' or 'char'
 * @param {string?} [value=null] - Value to set the nickname to - If not given, the nickname will be read instead
 * @param {'chat'|'char'|'global'?} [forContext=null] - Context in which to handle the nickname - Can be 'chat', 'char', or 'global'. If not given, the first nickname found in the context in the specified order will be returned
 * @param {object} [options] - Optional arguments
 * @param {boolean} [options.reset=false] - If true, the nickname will be reset to its default value
 *
 * @returns {string} The nickname value after handling
 */
function handleNickname(type, value = null, forContext = null, { reset = false } = {}) {
    value = value?.trim();

    if (forContext && !['chat', 'char', 'global'].includes(forContext)) {
        throw new Error(`Unknown context: ${forContext}`);
    }
    if (!forContext && (value || reset)) {
        throw new Error('Can\'t set nickanme or reset it without a context');
    }

    if (forContext === 'chat' || !forContext) {
        const metadata = getContext().chatMetadata[SETTNGS_NAME] ??= { chars: {}, personas: {} };
        const chatTypeKey = type === 'char' ? 'personas' : 'chars';

        // Reset -> return
        if (reset) {
            delete metadata[chatTypeKey][type];
            saveChatDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            metadata[chatTypeKey][type] = value;
            saveChatDebounced();
            return value;
        }
        // Return if set
        if (forContext || metadata[chatTypeKey][type]) {
            return metadata[chatTypeKey][type];
        }
    }

    if (forContext === 'char' || !forContext) {
        if (type === 'char' && (value || reset)) {
            toastr.warning('Cannot set character nickname on character level', 'Nicknames');
            return '';
        }

        const charKey = getCharKey();
        const nicknameKey = getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.char[charKey]?.personas[nicknameKey];
            saveSettingsDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            settings.mappings.char[charKey] ??= { personas: {} };
            settings.mappings.char[charKey].personas[nicknameKey] = value;
            saveSettingsDebounced();
            return value;
        }
        // Return if set
        if (forContext || settings.mappings.char[charKey]?.personas[nicknameKey]) {
            return settings.mappings.char[charKey]?.personas[nicknameKey];
        }
    }

    if (forContext === 'global' || !forContext) {
        const globalTypeKey = type === 'char' ? 'personas' : 'chars';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.global[globalTypeKey][nicknameKey];
            saveSettingsDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            settings.mappings.global[globalTypeKey][nicknameKey] = value;
            saveSettingsDebounced();
            return value;
        }
        // Return if set
        if (forContext || settings.mappings.global[globalTypeKey][nicknameKey]) {
            return settings.mappings.global[globalTypeKey][nicknameKey];
        }
    }

    // Default, if no nickname is set, just return the current default names
    return type === 'char' ? getContext().name2 : getContext().name1;
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameUserCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('user', nickname, args.for);
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameCharCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('char', nickname, args.for);
}

function registerNicknamesSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-user',
        aliases: ['nickname-persona'],
        callback: nicknameUserCallback,
        returns: 'nickname of the current user',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'char', 'global'],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'the nickname',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: 'Sets the nickname of the current user - or ',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-char',
        callback: nicknameCharCallback,
        returns: 'nickname of the current character',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'user', 'global'],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'the nickname',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: 'Sets the nickname of the current character - or ',
    }));
}

// This function is called when the extension is loaded
$(async () => {
    getContext().registerMacro('user', getUserNickname);
    getContext().registerMacro('char', getCharNickname);

    loadSettings();
    registerNicknamesSlashCommands();
});
