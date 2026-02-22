export const RegistrationState = {
  NOT_REGISTERED: 'not_registered',
  NAME_ENTERED: 'name_entered',
  REGISTERED: 'confirmed',
} as const;

export type RegistrationStateType = (typeof RegistrationState)[keyof typeof RegistrationState];
