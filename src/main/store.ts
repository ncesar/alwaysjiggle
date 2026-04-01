import Store from 'electron-store';
import { AppSettings } from './types';

const store = new Store<AppSettings>({
  schema: {
    enabled: {
      type: 'boolean',
      default: false,
    },
    mode: {
      type: 'string',
      enum: ['standard', 'zen'],
      default: 'standard',
    },
    interval: {
      type: 'number',
      default: 60,
    },
    launchOnLogin: {
      type: 'boolean',
      default: false,
    },
    neverOnBattery: {
      type: 'boolean',
      default: true,
    },
    neverOnLockScreen: {
      type: 'boolean',
      default: true,
    },
    schedules: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id:        { type: 'string' },
          enabled:   { type: 'boolean' },
          days:      { type: 'array', items: { type: 'number' } },
          startTime: { type: 'string' },
          endTime:   { type: 'string' },
        },
      },
    },
  },
});

export default store;
