import { extension_settings, getContext } from '../../../extensions.js';
import { saveChatDebounced, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

let settings = {
    mappings: {
        char: {
            /** @type {{[personaKey: string]: string}} Mapping of persona keys to a char nickname */
            personas: {},
        },
        global: {
            /** @type {{[personaKey: string]: string}} Mapping of persona keys to a char nickname */
            personas: {},
            /** @type {{[charKey: string]: string}} Mapping of char keys to a persona nickname */
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
    return getContext().name1;
}

function getCharNickname() {
    return getContext().name2;
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

    switch (forContext) {
        case 'chat': {
            getContext().chatMetadata ??= {};
            const metadata = getContext().chatMetadata[SETTNGS_NAME] ??= {};

            if (reset) {
                delete metadata[type];
                saveChatDebounced();
            } else if (value) {
                metadata[type] = value;
                saveChatDebounced();
            }
            return metadata[type] || '';
        }
        case 'char': {
            if (type === 'char') {
                toastr.warning('Cannot set character nickname on character level', 'Nicknames');
                return '';
            }

            if (reset) {
                delete settings.mappings.char[getPersonaKey()];
                saveSettingsDebounced();
            } else if (value) {
                settings.mappings.char[getPersonaKey()] = value;
                saveSettingsDebounced();
            }
            return settings.mappings.char[getPersonaKey()] || '';
        }
        case 'global': {
            const globalTypeKey = type === 'char' ? 'personas' : 'chars';
            const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

            if (reset) {
                delete settings.mappings.global[globalTypeKey][nicknameKey];
                saveSettingsDebounced();
            } else if (value) {
                settings.mappings.global[globalTypeKey][nicknameKey] = value;
                saveSettingsDebounced();
            }
            return settings.mappings.global[globalTypeKey][nicknameKey] || '';
        }
        default: throw new Error(`Unknown context: ${forContext}`);
    }
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameUserCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('user', nickname, args.for || 'chat');
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameCharCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('char', nickname, args.for || 'chat');
}

function registerNicknamesSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-user',
        callback: nicknameUserCallback,
        returns: 'nickname of the current user',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'At which context the nickname should be set',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'char', 'global'],
                forceEnum: true,
                defaultValue: 'chat',
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
                description: 'At which context the nickname should be set',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'user', 'global'],
                forceEnum: true,
                defaultValue: 'chat',
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
