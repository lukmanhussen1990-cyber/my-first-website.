import {getInputProps} from 'remotion';

// "Lite" turns heavy effects off for quick previews (pass --props='{"lite":true}').
export const useRemotionLite = () => Boolean((getInputProps() as {lite?: boolean}).lite);
