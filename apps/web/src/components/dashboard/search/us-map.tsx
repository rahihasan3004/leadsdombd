"use client";

import { useMemo } from "react";
import { US_STATES } from "@fine-leads/utils";

const STATE_PATHS: Record<string, string> = {
  AL: "M635,299 L639,295 L643,296 L647,293 L650,295 L652,299 L650,305 L648,309 L644,310 L639,310 L634,307 L632,303 Z",
  AK: "M100,315 L108,311 L115,314 L121,318 L128,315 L135,317 L142,313 L148,316 L152,321 L148,326 L141,328 L133,325 L125,328 L118,325 L108,328 L99,324 L95,319 Z",
  AZ: "M168,250 L173,246 L178,248 L183,245 L188,248 L192,252 L188,257 L183,259 L178,256 L173,259 L168,256 L165,253 Z",
  AR: "M518,276 L524,272 L528,274 L532,271 L537,274 L539,278 L536,283 L531,285 L526,283 L521,285 L515,283 L512,279 Z",
  CA: "M55,205 L64,198 L72,200 L80,196 L90,192 L100,196 L108,194 L116,198 L122,203 L118,210 L112,214 L102,218 L92,220 L80,218 L70,215 L60,218 L50,214 L47,209 Z",
  CO: "M283,192 L291,187 L298,189 L305,185 L311,187 L314,192 L310,198 L304,200 L297,197 L290,200 L283,197 L277,195 Z",
  CT: "M790,139 L794,136 L797,137 L799,140 L797,143 L793,144 L790,142 Z",
  DE: "M756,207 L760,204 L762,205 L762,208 L760,210 L757,210 L755,208 Z",
  FL: "M645,365 L652,358 L658,359 L666,356 L674,360 L680,365 L675,372 L667,376 L658,378 L649,376 L642,372 L639,367 Z",
  GA: "M686,298 L692,294 L697,295 L701,300 L698,306 L692,309 L686,306 L683,302 Z",
  HI: "M263,368 L270,364 L277,367 L282,371 L278,377 L270,380 L262,377 L257,373 Z",
  IA: "M468,178 L475,173 L480,174 L485,170 L491,173 L494,178 L490,184 L485,187 L478,185 L473,187 L465,184 L462,180 Z",
  ID: "M152,125 L161,119 L168,122 L176,118 L183,121 L187,127 L182,134 L175,136 L166,134 L158,137 L149,133 L145,128 Z",
  IL: "M558,221 L563,216 L568,218 L573,214 L578,218 L580,224 L576,230 L569,233 L561,230 L555,228 Z",
  IN: "M580,207 L585,202 L590,203 L594,200 L599,204 L601,209 L597,215 L591,216 L585,213 L580,216 L575,213 L573,209 Z",
  KS: "M407,238 L414,233 L419,235 L424,230 L430,234 L433,240 L428,246 L422,248 L416,245 L409,248 L401,244 L398,240 Z",
  KY: "M600,239 L606,234 L612,236 L616,240 L613,246 L607,249 L601,245 L596,242 Z",
  LA: "M519,325 L526,319 L532,321 L537,317 L543,320 L546,326 L542,333 L535,337 L527,339 L518,336 L513,330 Z",
  MA: "M793,127 L797,123 L800,124 L802,128 L799,132 L795,133 L792,130 Z",
  MD: "M725,211 L731,207 L735,208 L738,205 L741,208 L742,213 L738,218 L732,220 L726,217 L722,214 Z",
  ME: "M808,80 L815,75 L820,77 L823,81 L820,87 L814,90 L806,87 L803,83 Z",
  MI: "M597,158 L603,152 L608,154 L613,150 L619,154 L621,160 L617,166 L611,168 L604,165 L598,168 L593,164 L591,160 Z",
  MN: "M437,118 L445,112 L452,114 L458,110 L466,113 L469,119 L464,127 L456,130 L448,127 L440,131 L431,127 L428,122 Z",
  MO: "M498,249 L504,244 L510,245 L515,241 L521,245 L524,251 L519,258 L513,261 L506,257 L500,259 L494,255 L491,251 Z",
  MS: "M563,301 L570,296 L575,298 L580,294 L585,297 L588,303 L584,309 L578,311 L571,308 L565,311 L557,307 L555,303 Z",
  MT: "M248,98 L257,92 L265,94 L273,90 L281,93 L284,99 L279,106 L271,109 L262,106 L253,109 L244,105 L240,101 Z",
  NC: "M695,269 L703,264 L709,265 L713,260 L718,263 L721,269 L716,276 L709,279 L701,276 L694,272 Z",
  ND: "M356,105 L364,100 L370,102 L376,98 L383,101 L386,107 L381,113 L374,116 L365,113 L357,115 L349,112 L346,108 Z",
  NE: "M352,194 L360,188 L366,190 L372,185 L379,189 L382,195 L377,202 L370,204 L362,201 L355,204 L347,200 L344,196 Z",
  NH: "M798,113 L802,109 L805,110 L807,113 L805,118 L801,120 L797,117 Z",
  NJ: "M773,190 L777,186 L779,187 L781,191 L779,196 L774,198 L770,195 L768,192 Z",
  NM: "M254,276 L261,270 L268,272 L275,267 L281,270 L284,276 L280,283 L273,285 L265,282 L258,285 L249,282 L246,278 Z",
  NV: "M107,191 L116,185 L123,187 L130,182 L138,186 L142,192 L137,199 L129,201 L121,198 L113,201 L103,197 L100,193 Z",
  NY: "M759,148 L765,142 L771,144 L777,139 L783,142 L786,148 L781,155 L775,157 L767,154 L760,156 L753,153 L750,149 Z",
  OH: "M640,206 L646,200 L651,202 L656,198 L662,201 L664,207 L659,214 L653,216 L645,213 L640,216 L635,213 L632,209 Z",
  OK: "M421,278 L429,272 L435,274 L441,269 L448,272 L451,278 L446,285 L439,288 L432,284 L425,287 L418,283 L415,279 Z",
  OR: "M80,132 L89,126 L97,128 L105,123 L113,126 L117,132 L112,139 L103,141 L95,138 L86,141 L77,137 L73,133 Z",
  PA: "M707,185 L715,179 L720,180 L725,176 L731,179 L733,185 L727,191 L720,194 L712,190 L706,188 Z",
  RI: "M810,142 L813,140 L815,141 L816,143 L814,146 L810,146 L809,144 Z",
  SC: "M715,297 L721,292 L726,293 L730,288 L734,292 L736,297 L732,304 L725,306 L718,303 L713,300 Z",
  SD: "M333,152 L341,146 L348,148 L354,143 L361,146 L364,152 L359,158 L351,160 L343,157 L335,160 L327,157 L324,153 Z",
  TN: "M616,266 L623,261 L628,262 L633,258 L638,262 L640,268 L636,274 L629,277 L621,273 L615,270 Z",
  TX: "M383,324 L392,318 L400,320 L408,316 L417,320 L420,326 L415,333 L407,336 L398,333 L389,336 L379,332 L376,328 Z",
  UT: "M199,203 L206,198 L213,200 L219,195 L225,198 L228,203 L224,210 L218,213 L210,210 L202,213 L194,209 L191,205 Z",
  VA: "M700,231 L707,226 L713,228 L718,224 L723,227 L726,233 L720,240 L713,242 L705,238 L699,235 Z",
  VT: "M785,107 L789,103 L792,104 L794,107 L792,112 L788,113 L784,110 Z",
  WA: "M119,92 L128,87 L136,89 L144,85 L152,88 L156,93 L151,100 L143,102 L134,99 L125,102 L116,98 L112,94 Z",
  WI: "M518,150 L523,145 L528,147 L533,143 L540,147 L543,153 L538,159 L532,161 L525,158 L519,161 L513,158 L510,154 Z",
  WV: "M661,225 L668,220 L673,222 L678,218 L683,222 L685,228 L680,234 L673,236 L666,232 L660,229 Z",
  WY: "M276,152 L284,147 L290,149 L297,144 L303,148 L306,153 L301,160 L294,162 L287,159 L279,162 L272,158 L268,155 Z",
  DC: "M740,219 L743,217 L745,218 L746,221 L744,223 L741,223 L739,221 Z",
};

const REGIONS: Record<string, string[]> = {
  Eastern: [
    "ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD",
    "DC", "VA", "WV", "NC", "SC", "GA", "FL",
  ],
  Central: [
    "ND", "SD", "NE", "KS", "MN", "IA", "MO", "WI", "IL", "MI", "IN",
    "OH", "KY", "TN", "MS", "AL", "AR", "LA", "OK", "TX",
  ],
  Western: [
    "WA", "OR", "CA", "NV", "ID", "MT", "WY", "CO", "UT", "AZ", "NM",
    "AK", "HI",
  ],
};

const ALL_STATE_CODES = US_STATES.map((s) => s.code);

interface USMapProps {
  selectedStates: string[];
  onToggleState: (code: string) => void;
  onSelectRegion: (codes: string[]) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function USMap({
  selectedStates,
  onToggleState,
  onSelectRegion,
  onSelectAll,
  onClearAll,
}: USMapProps) {
  const allSelected = selectedStates.length === ALL_STATE_CODES.length;

  const selectedSet = useMemo(
    () => new Set(selectedStates),
    [selectedStates],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="inline-flex items-center gap-1.5 rounded-sm bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-2.5 py-1">
          <span className="text-[10px] font-bold tabular-nums text-surface-600 dark:text-surface-400">
            {selectedStates.length}
          </span>
          <span className="text-[10px] text-surface-500 dark:text-surface-400">
            State{selectedStates.length !== 1 ? "s" : ""} Selected
          </span>
        </div>
        <div className="flex items-center gap-1">
          {["Select All", "Eastern", "Central", "Western", "Clear All"].map(
            (label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === "Select All") {
                    if (allSelected) onClearAll();
                    else onSelectAll();
                  } else if (label === "Clear All") {
                    onClearAll();
                  } else if (REGIONS[label]) {
                    const regionCodes = REGIONS[label];
                    const allInRegionSelected = regionCodes.every((c) =>
                      selectedSet.has(c),
                    );
                    if (allInRegionSelected) {
                      onSelectRegion(
                        selectedStates.filter((c) => !regionCodes.includes(c)),
                      );
                    } else {
                      const merged = new Set([...selectedStates, ...regionCodes]);
                      onSelectRegion(Array.from(merged));
                    }
                  }
                }}
                className={`text-[11px] font-medium rounded-sm border px-2.5 py-1 transition-colors ${
                  (label === "Select All" && allSelected) ||
                  (label !== "Select All" &&
                    label !== "Clear All" &&
                    REGIONS[label]?.every((c) => selectedSet.has(c)))
                    ? "bg-surface-950 dark:bg-white text-white dark:text-surface-950 border-surface-950 dark:border-white"
                    : "text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-200"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <svg
          viewBox="30 60 520 340"
          className="w-full h-full max-h-[520px]"
          style={{ overflow: "visible" }}
        >
          {ALL_STATE_CODES.map((code) => {
            const pathD = STATE_PATHS[code];
            if (!pathD) return null;
            const isSelected = selectedSet.has(code);
            return (
              <g key={code}>
                <path
                  d={pathD}
                  className={`${
                    isSelected
                      ? "fill-surface-950 dark:fill-white stroke-surface-950 dark:stroke-white cursor-pointer"
                      : "fill-surface-100 dark:fill-surface-800 stroke-surface-300 dark:stroke-surface-600 cursor-pointer hover:fill-surface-200 dark:hover:fill-surface-700"
                  } stroke-[1.5] transition-colors`}
                  onClick={() => onToggleState(code)}
                />
                <text
                  x={getStateCenter(code)}
                  y={getStateCenterY(code)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-[6px] font-bold pointer-events-none ${
                    isSelected
                      ? "fill-white dark:fill-surface-950"
                      : "fill-surface-400 dark:fill-surface-500"
                  }`}
                >
                  {code}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function getStateCenter(code: string): number {
  const pathD = STATE_PATHS[code];
  if (!pathD) return 0;
  const coords = pathD.match(/[\d.]+/g);
  if (!coords || coords.length < 6) return 0;
  let sumX = 0;
  let count = 0;
  for (let i = 0; i < coords.length - 1; i += 2) {
    sumX += parseFloat(coords[i]);
    count++;
  }
  return sumX / count;
}

function getStateCenterY(code: string): number {
  const pathD = STATE_PATHS[code];
  if (!pathD) return 0;
  const coords = pathD.match(/[\d.]+/g);
  if (!coords || coords.length < 6) return 0;
  let sumY = 0;
  let count = 0;
  for (let i = 1; i < coords.length; i += 2) {
    sumY += parseFloat(coords[i]);
    count++;
  }
  return sumY / count + 0.5;
}