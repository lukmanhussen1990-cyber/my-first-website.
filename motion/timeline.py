"""Shared timeline (seconds) so picture and sound stay in sync."""
DURATION = 40.0
FPS = 60

T_IGNITE = 2.0          # point of light ignites at the central node
T_BEAM = 2.3            # light beams draw the skeleton
BEAM_SCALE = 1.45       # stretch factor for the skeleton timings in logo_geom
T_PULSE = 7.4           # data pulses start travelling the skeleton
T_GUIDES = 8.6          # construction guides draw in
T_TRACE = 9.4           # outline tracing
T_BUILD = 14.6          # energy build-up
T_IMPACT = 17.0         # solid mark slams in
T_GLINT1 = 20.2
T_3D = 23.0             # extrusion + orbit
T_SPIN0, T_SPIN1 = 25.6, 30.2
T_RETURN0, T_RETURN1 = 30.2, 33.0
T_GLINT2 = 34.4
T_FADE0, T_FADE1 = 37.8, 39.7
