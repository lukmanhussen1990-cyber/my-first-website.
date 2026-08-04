# The Hollow Bride - step 8/8: every scripted prop, placed last so nothing
# earlier in the build can overwrite it.
# --- Nursery: the music box melody, all starting on note 0 ---
setblock 1003 65 1033 ag:toy_block ["ag:note"=0]
setblock 1004 65 1033 ag:toy_block ["ag:note"=0]
setblock 1005 65 1033 ag:toy_block ["ag:note"=0]
setblock 1006 65 1033 ag:toy_block ["ag:note"=0]
setblock 1007 65 1033 ag:toy_block ["ag:note"=0]
# --- Cellar: six name plaques ---
setblock 1011 51 1039 ag:name_plaque ["ag:name_id"=0]
setblock 1012 51 1039 ag:name_plaque ["ag:name_id"=1]
setblock 1013 51 1039 ag:name_plaque ["ag:name_id"=2]
setblock 1014 51 1039 ag:name_plaque ["ag:name_id"=3]
setblock 1015 51 1039 ag:name_plaque ["ag:name_id"=4]
setblock 1016 51 1039 ag:name_plaque ["ag:name_id"=5]
# --- Mirror Wing: five glasses, the third is the honest one ---
setblock 1023 65 1039 ag:mirror ["ag:broken"=false]
setblock 1024 65 1039 ag:mirror ["ag:broken"=false]
setblock 1026 65 1039 ag:mirror ["ag:broken"=false]
setblock 1028 65 1039 ag:mirror ["ag:broken"=false]
setblock 1030 65 1039 ag:mirror ["ag:broken"=false]
# --- Gallery: five portraits ---
setblock 1011 73 1012 ag:portrait ["ag:index"=0,"ag:wrong"=false]
setblock 1013 73 1012 ag:portrait ["ag:index"=1,"ag:wrong"=false]
setblock 1015 73 1012 ag:portrait ["ag:index"=2,"ag:wrong"=false]
setblock 1017 73 1012 ag:portrait ["ag:index"=3,"ag:wrong"=false]
setblock 1019 73 1012 ag:portrait ["ag:index"=4,"ag:wrong"=false]
# --- Key pedestals ---
setblock 1004 65 1039 ag:key_pedestal ["ag:key_id"=1,"ag:taken"=false]
setblock 1015 51 1031 ag:key_pedestal ["ag:key_id"=2,"ag:taken"=false]
setblock 1027 65 1031 ag:key_pedestal ["ag:key_id"=3,"ag:taken"=false]
setblock 1015 72 1024 ag:key_pedestal ["ag:key_id"=4,"ag:taken"=false]
setblock 1015 78 1021 ag:key_pedestal ["ag:key_id"=5,"ag:taken"=false]
# --- Twelve torn pages ---
setblock 1010 65 1025 ag:story_page ["ag:page_id"=1]
setblock 1021 65 1013 ag:story_page ["ag:page_id"=2]
setblock 1000 65 1040 ag:story_page ["ag:page_id"=3]
setblock 1008 65 1028 ag:story_page ["ag:page_id"=4]
setblock 1011 51 1029 ag:story_page ["ag:page_id"=5]
setblock 1020 51 1040 ag:story_page ["ag:page_id"=6]
setblock 1023 65 1028 ag:story_page ["ag:page_id"=7]
setblock 1031 65 1040 ag:story_page ["ag:page_id"=8]
setblock 1010 72 1026 ag:story_page ["ag:page_id"=9]
setblock 1021 72 1013 ag:story_page ["ag:page_id"=10]
setblock 1010 78 1026 ag:story_page ["ag:page_id"=11]
setblock 1020 78 1013 ag:story_page ["ag:page_id"=12]
# --- Threshold: sealed on entry by the script, cleared again at Dawn ---
setblock 1015 65 1010 air
setblock 1015 66 1010 air
# --- Hiding furniture and the mailbox, re-asserted ---
setblock 1002 65 1031 ag:wardrobe ["ag:occupied"=false]
setblock 1007 65 1036 ag:wardrobe ["ag:occupied"=false]
setblock 1004 65 1029 ag:under_bed ["ag:occupied"=false]
setblock 1015 65 1000 ag:mailbox ["ag:opened"=false]
# --- Attic sconces, all cold ---
setblock 1011 78 1014 ag:wall_candle ["ag:lit"=false]
setblock 1020 78 1014 ag:wall_candle ["ag:lit"=false]
setblock 1011 78 1024 ag:wall_candle ["ag:lit"=false]
setblock 1020 78 1024 ag:wall_candle ["ag:lit"=false]
