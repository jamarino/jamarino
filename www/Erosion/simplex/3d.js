"use strict";
// This is free and unencumbered software released into the public domain
import shuffleSeed from "./shuffle_seed.js";

const NORM_3D = 1.0 / 103.0;
const SQUISH_3D = (Math.sqrt(3 + 1) - 1) / 3;
const STRETCH_3D = (1 / Math.sqrt(3 + 1) - 1) / 3;

function contribution3D(multiplier, xsb, ysb, zsb) {
    return {
        dx: -xsb - multiplier * SQUISH_3D,
        dy: -ysb - multiplier * SQUISH_3D,
        dz: -zsb - multiplier * SQUISH_3D,
        xsb: xsb,
        ysb: ysb,
        zsb: zsb,
    };
}

export function makeNoise3D(clientSeed) {
    var contributions = [];
    for (var i = 0; i < p3D.length; i += 9) {
        var baseSet = base3D[p3D[i]];
        var previous = null;
        var current = null;
        for (var k = 0; k < baseSet.length; k += 4) {
            current = contribution3D(baseSet[k], baseSet[k + 1], baseSet[k + 2], baseSet[k + 3]);
            if (previous === null)
                contributions[i / 9] = current;
            else
                previous.next = current;
            previous = current;
        }
        current.next = contribution3D(p3D[i + 1], p3D[i + 2], p3D[i + 3], p3D[i + 4]);
        current.next.next = contribution3D(p3D[i + 5], p3D[i + 6], p3D[i + 7], p3D[i + 8]);
    }
    var lookup = [];
    for (var i = 0; i < lookupPairs3D.length; i += 2) {
        lookup[lookupPairs3D[i]] = contributions[lookupPairs3D[i + 1]];
    }
    var perm = new Uint8Array(256);
    var perm3D = new Uint8Array(256);
    var source = new Uint8Array(256);
    for (var i = 0; i < 256; i++)
        source[i] = i;
    var seed = new Uint32Array(1);
    seed[0] = clientSeed;
    seed = shuffleSeed(shuffleSeed(shuffleSeed(seed)));
    for (var i = 255; i >= 0; i--) {
        seed = shuffleSeed(seed);
        var r = new Uint32Array(1);
        r[0] = (seed[0] + 31) % (i + 1);
        if (r[0] < 0)
            r[0] += i + 1;
        perm[i] = source[r[0]];
        perm3D[i] = (perm[i] % 24) * 3;
        source[r[0]] = source[i];
    }
    return function (x, y, z) {
        var stretchOffset = (x + y + z) * STRETCH_3D;
        var xs = x + stretchOffset;
        var ys = y + stretchOffset;
        var zs = z + stretchOffset;
        var xsb = Math.floor(xs);
        var ysb = Math.floor(ys);
        var zsb = Math.floor(zs);
        var squishOffset = (xsb + ysb + zsb) * SQUISH_3D;
        var dx0 = x - (xsb + squishOffset);
        var dy0 = y - (ysb + squishOffset);
        var dz0 = z - (zsb + squishOffset);
        var xins = xs - xsb;
        var yins = ys - ysb;
        var zins = zs - zsb;
        var inSum = xins + yins + zins;
        var hash = (yins - zins + 1) |
            ((xins - yins + 1) << 1) |
            ((xins - zins + 1) << 2) |
            (inSum << 3) |
            ((inSum + zins) << 5) |
            ((inSum + yins) << 7) |
            ((inSum + xins) << 9);
        var value = 0;
        for (var c = lookup[hash]; c !== undefined; c = c.next) {
            var dx = dx0 + c.dx;
            var dy = dy0 + c.dy;
            var dz = dz0 + c.dz;
            var attn = 2 - dx * dx - dy * dy - dz * dz;
            if (attn > 0) {
                var px = xsb + c.xsb;
                var py = ysb + c.ysb;
                var pz = zsb + c.zsb;
                var indexPartA = perm[px & 0xff];
                var indexPartB = perm[(indexPartA + py) & 0xff];
                var index = perm3D[(indexPartB + pz) & 0xff];
                var valuePart = gradients3D[index] * dx +
                    gradients3D[index + 1] * dy +
                    gradients3D[index + 2] * dz;
                value += attn * attn * attn * attn * valuePart;
            }
        }
        return value * NORM_3D;
    };
}

var base3D = [
    [0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
    [2, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 3, 1, 1, 1],
    [1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 2, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1],
];
var gradients3D = [
    -11,
    4,
    4,
    -4,
    11,
    4,
    -4,
    4,
    11,
    11,
    4,
    4,
    4,
    11,
    4,
    4,
    4,
    11,
    -11,
    -4,
    4,
    -4,
    -11,
    4,
    -4,
    -4,
    11,
    11,
    -4,
    4,
    4,
    -11,
    4,
    4,
    -4,
    11,
    -11,
    4,
    -4,
    -4,
    11,
    -4,
    -4,
    4,
    -11,
    11,
    4,
    -4,
    4,
    11,
    -4,
    4,
    4,
    -11,
    -11,
    -4,
    -4,
    -4,
    -11,
    -4,
    -4,
    -4,
    -11,
    11,
    -4,
    -4,
    4,
    -11,
    -4,
    4,
    -4,
    -11,
];
var lookupPairs3D = [
    0,
    2,
    1,
    1,
    2,
    2,
    5,
    1,
    6,
    0,
    7,
    0,
    32,
    2,
    34,
    2,
    129,
    1,
    133,
    1,
    160,
    5,
    161,
    5,
    518,
    0,
    519,
    0,
    546,
    4,
    550,
    4,
    645,
    3,
    647,
    3,
    672,
    5,
    673,
    5,
    674,
    4,
    677,
    3,
    678,
    4,
    679,
    3,
    680,
    13,
    681,
    13,
    682,
    12,
    685,
    14,
    686,
    12,
    687,
    14,
    712,
    20,
    714,
    18,
    809,
    21,
    813,
    23,
    840,
    20,
    841,
    21,
    1198,
    19,
    1199,
    22,
    1226,
    18,
    1230,
    19,
    1325,
    23,
    1327,
    22,
    1352,
    15,
    1353,
    17,
    1354,
    15,
    1357,
    17,
    1358,
    16,
    1359,
    16,
    1360,
    11,
    1361,
    10,
    1362,
    11,
    1365,
    10,
    1366,
    9,
    1367,
    9,
    1392,
    11,
    1394,
    11,
    1489,
    10,
    1493,
    10,
    1520,
    8,
    1521,
    8,
    1878,
    9,
    1879,
    9,
    1906,
    7,
    1910,
    7,
    2005,
    6,
    2007,
    6,
    2032,
    8,
    2033,
    8,
    2034,
    7,
    2037,
    6,
    2038,
    7,
    2039,
    6,
];
var p3D = [
    0,
    0,
    1,
    -1,
    0,
    0,
    1,
    0,
    -1,
    0,
    0,
    -1,
    1,
    0,
    0,
    0,
    1,
    -1,
    0,
    0,
    -1,
    0,
    1,
    0,
    0,
    -1,
    1,
    0,
    2,
    1,
    1,
    0,
    1,
    1,
    1,
    -1,
    0,
    2,
    1,
    0,
    1,
    1,
    1,
    -1,
    1,
    0,
    2,
    0,
    1,
    1,
    1,
    -1,
    1,
    1,
    1,
    3,
    2,
    1,
    0,
    3,
    1,
    2,
    0,
    1,
    3,
    2,
    0,
    1,
    3,
    1,
    0,
    2,
    1,
    3,
    0,
    2,
    1,
    3,
    0,
    1,
    2,
    1,
    1,
    1,
    0,
    0,
    2,
    2,
    0,
    0,
    1,
    1,
    0,
    1,
    0,
    2,
    0,
    2,
    0,
    1,
    1,
    0,
    0,
    1,
    2,
    0,
    0,
    2,
    2,
    0,
    0,
    0,
    0,
    1,
    1,
    -1,
    1,
    2,
    0,
    0,
    0,
    0,
    1,
    -1,
    1,
    1,
    2,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    -1,
    2,
    3,
    1,
    1,
    1,
    2,
    0,
    0,
    2,
    2,
    3,
    1,
    1,
    1,
    2,
    2,
    0,
    0,
    2,
    3,
    1,
    1,
    1,
    2,
    0,
    2,
    0,
    2,
    1,
    1,
    -1,
    1,
    2,
    0,
    0,
    2,
    2,
    1,
    1,
    -1,
    1,
    2,
    2,
    0,
    0,
    2,
    1,
    -1,
    1,
    1,
    2,
    0,
    0,
    2,
    2,
    1,
    -1,
    1,
    1,
    2,
    0,
    2,
    0,
    2,
    1,
    1,
    1,
    -1,
    2,
    2,
    0,
    0,
    2,
    1,
    1,
    1,
    -1,
    2,
    0,
    2,
    0,
];
