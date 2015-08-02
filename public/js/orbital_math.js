var OrbitalMath = {
  partsOfUniversalDateTime: function(time){
    var parts = {}
    if (time == null) {
      time = 0;
    }
    parts.year = ((time / (365 * 24 * 3600)) | 0) + 1;
    time %= 365 * 24 * 3600;
    parts.day = ((time / (24 * 3600)) | 0) + 1;
    time %= 24 * 3600;
    parts.universalTime = time

    parts.hour = (time / 3600) | 0;
    time %= 3600;
    parts.minutes = (time / 60) | 0;
    parts.seconds = (time % 60 | 0).toFixed();

    return parts
  },

  calculateGMSTInDegrees: function(universalDateTime){
    var timeParts = partsOfUniversalDateTime(universalDateTime)
    var G = 6.697374558
    var dayFactor = 0.06570982441908
    var timeFactor = 1.00273790935
    return G + (dayFactor * timeParts.day) + (timeFactor * timeParts.hour)
  },

  eccentricAnomalyFromTrueAnomalyAndEcentricity: function(trueAnomaly, eccentricity){
    // var cosineE = (eccentricity + Math.cos(trueAnomaly))/(1 + (eccentricity* Math.cos(trueAnomaly)))
    // return Math.acos(cosineE)
    var factor1 = Math.sqrt(1 - Math.pow(eccentricity, 2)) * Math.sin(trueAnomaly)
    var factor2 = eccentricity + Math.cos(trueAnomaly)

    return Math.atan2(factor2, factor1)
  },

  meanMotionFromGravitationalParametersAndSemimajorAxis: function(gravitationalParameter, semiMajorAxis, orbitalPeriod){
    // console.log("mu : " + gravitationalParameter + " SMA : " + semiMajorAxis)
    // return orbitalPeriod * Math.sqrt(gravitationalParameter/(4 * Math.pow(Math.PI, 2) * Math.pow(semiMajorAxis, 3)))
    return Math.sqrt(gravitationalParameter/Math.pow(semiMajorAxis, 3))
  },

  meanAnomalyFromEccentricAnomalyAndEccentricity: function(eccentricAnomaly, eccentricity){
    return eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly)
  },

  meanAnomalyAtTimeAndMeanMotion: function(meanMotion, startTime, endTime, originalMeanAnomaly){
    var deltaT = endTime - startTime
    return originalMeanAnomaly + meanMotion * deltaT
  },

  estimateEccentricAnomalyFromMeanAnomalyAndEccentricity: function(meanAnomaly, eccentricity){
    var error = 100
    var eccentricAnomaly1 = meanAnomaly

    while(error > 0.00000000001){
      var newEccentricAnomaly = meanAnomaly + (eccentricity * Math.sin(eccentricAnomaly1))
      error = Math.abs(newEccentricAnomaly - eccentricAnomaly1)
      eccentricAnomaly1 = newEccentricAnomaly
    }
    return eccentricAnomaly1
  },

  trueAnomalyFromEccentricAnomalyAndEccentricity: function(eccentricAnomaly, eccentricity, meanAnomaly){
    var factor1 = eccentricity - Math.cos(eccentricAnomaly)
    var factor2 = (eccentricity * Math.cos(eccentricAnomaly)) - 1

    var cosV = factor1/factor2
    var V = Math.acos(cosV)

    var meanAnomalyUnitCircle = Math.toDegrees(meanAnomaly) % 360

    if(meanAnomalyUnitCircle >= 0 &&  meanAnomalyUnitCircle <= 180){
      return Math.toRadians(360) - V
    } else{
      return V
    }
  },

  findSemiLatusRectum: function(semiMajorAxis, eccentricity){
    return semiMajorAxis * (1 - Math.pow(eccentricity, 2))
  },

  findPolarEquationOfConic: function(semiMajorAxis, eccentricity, trueAnomaly){
    var p = this.findSemiLatusRectum(semiMajorAxis, eccentricity)

    return p/(1 + eccentricity * Math.cos(trueAnomaly))
  },

  positionVectorInPQWFrame: function(semiMajorAxis, eccentricity, trueAnomaly){
    var r = this.findPolarEquationOfConic(semiMajorAxis, eccentricity, trueAnomaly)
    var vector = {}
    vector.p = r * Math.cos(trueAnomaly)
    vector.q = r * Math.sin(trueAnomaly)
    vector.w = 0
    return vector
  },

  velocityVectorInPQWFrame: function(semiMajorAxis, eccentricity, trueAnomaly, gravitationalParameter){
    var p = findSemiLatusRectum(semiMajorAxis, eccentricity)
    var factor = Math.sqrt(gravitationalParameter/p)
    var vector = {}
    vector.p = -Math.sin(trueAnomaly)
    vector.q = eccentricity + Math.cos(trueAnomaly)
    vector.w = 0
    return vector
  },

  transformVector: function(matrix, vector){
    var vectorKeys = Object.keys(vector)
    var newVector = {}
    //iterate through the rows of the matrix
    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i]
      var derivativeVector = vectorKeys[i]
      //iterate through the columns
      for (var j = 0; j < vectorKeys.length; j++) {
        var currentKey = vectorKeys[j]
        if(!newVector[derivativeVector]){ newVector[derivativeVector] = 0 }
        newVector[derivativeVector] += vector[currentKey] * row[j]
      }
    }
    return newVector
  },

  // Thank god for: https://en.wikipedia.org/wiki/Perifocal_coordinate_system
  transformPositionPQWVectorToIJKFrame: function(vector, inclination, longitudeOfAscendingNode, argumentOfPeriapsis){
    var vectorIJK = {}
    var omega = longitudeOfAscendingNode
    var w = argumentOfPeriapsis
    var i = inclination

    //Column, row order. First level is columns, each column has N rows
    var transformationMatrix = [
      [
        // 1 1
        Math.cos(omega) * Math.cos(w) - Math.sin(omega) * Math.sin(w) * Math.cos(i),
        // 1 2
        -Math.cos(omega) * Math.sin(w) - Math.sin(omega)* Math.cos(w) * Math.cos(i),
        // 1 2
        Math.sin(omega) * Math.sin(i)
      ],
      [
        // 2 1
        Math.sin(omega) * Math.cos(w) + Math.cos(omega) * Math.sin(w) * Math.cos(i),
        // 2 2
        -Math.sin(omega) * Math.sin(w) + Math.cos(omega) * Math.cos(w) * Math.cos(i),
        // 2 3
        -Math.cos(omega) * Math.sin(i),
      ],
      [
        // 3 1
        Math.sin(w) * Math.sin(i),
        // 3 2
        Math.cos(w) * Math.sin(i),
        // 3 3
        Math.cos(i)
      ]
    ]

    var transformedPQW = this.transformVector(transformationMatrix, vector)
    vectorIJK.i = transformedPQW.p
    vectorIJK.j = transformedPQW.q
    vectorIJK.k = transformedPQW.w


    return vectorIJK
  },

  findLatitudeOfPositionUnitVector: function(vector){
    var x = Math.sqrt(Math.pow(vector.i, 2) + Math.pow(vector.j, 2))
    var z = vector.k

    return Math.atan(z/x)
  },

  angularFrequencyOfBody: function(period){
    return (2 * Math.PI)/period
  },

  calculateGMSTInRadiansForOrigin: function(vector, longitude){
    var theta = Math.atan(vector.j/vector.i)
    return theta - longitude
  },

  findLongitudeOfPositonUnitVector: function(vector, angularVelocityOfPlanet, startTime, endTime, GMSTInRadians){
    var deltaT = endTime - startTime
    var quadrant = vector.j > 0 ? 1 : -1
    var theta = Math.atan(vector.j/vector.i)
    return theta - GMSTInRadians - (angularVelocityOfPlanet * deltaT)
  }
}