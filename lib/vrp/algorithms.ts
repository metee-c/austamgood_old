// VRP (Vehicle Routing Problem) Algorithms
// Based on the legacy Google Apps Script implementation

interface Delivery {
  id: number;
  orderId?: number;
  stopName: string;
  address?: string;
  latitude: number;
  longitude: number;
  weight: number;
  volume?: number;
  units?: number;
  pallets?: number;
  serviceTime: number;
  priority?: number;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
}

interface Location {
  latitude: number;
  longitude: number;
}

interface Trip {
  stops: any[];
  totalDistance?: number;
  totalDriveTime?: number;
  totalServiceTime?: number;
  totalWeight?: number;
  totalVolume?: number;
  totalPallets?: number;
  totalUnits?: number;
  totalCost?: number;
  zoneId?: number;
  zoneName?: string;
  isOverweight?: boolean;
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geographic Clustering - K-Means
export function clusterDeliveriesIntoZones(
  deliveries: Delivery[],
  method: string,
  numZones: number,
  maxStoresPerZone: number
): Record<number, Delivery[]> {
  if (method === 'none' || deliveries.length <= 1) {
    return { 0: deliveries };
  }

  // Adjust number of zones based on delivery count
  const adjustedNumZones = Math.min(numZones, Math.ceil(deliveries.length / 2));

  if (adjustedNumZones <= 1) {
    return { 0: deliveries };
  }

  switch (method) {
    case 'kmeans':
      return clusterByKMeans(deliveries, adjustedNumZones);
    case 'grid':
      return clusterByGrid(deliveries, adjustedNumZones);
    case 'province':
      return clusterByProvince(deliveries, maxStoresPerZone);
    default:
      return { 0: deliveries };
  }
}

function clusterByKMeans(deliveries: Delivery[], numZones: number): Record<number, Delivery[]> {
  // Initialize centroids randomly
  const centroids: Location[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < numZones; i++) {
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * deliveries.length);
    } while (usedIndices.has(randomIndex));
    usedIndices.add(randomIndex);
    centroids.push({
      latitude: deliveries[randomIndex].latitude,
      longitude: deliveries[randomIndex].longitude
    });
  }

  // K-Means iterations
  const MAX_ITERATIONS = 10;
  let clusters: Delivery[][] = [];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Assign deliveries to nearest centroid
    clusters = Array(numZones).fill(null).map(() => []);

    for (const delivery of deliveries) {
      let minDistance = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < centroids.length; j++) {
        const distance = calculateDistance(
          delivery.latitude,
          delivery.longitude,
          centroids[j].latitude,
          centroids[j].longitude
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = j;
        }
      }

      clusters[bestCluster].push(delivery);
    }

    // Recalculate centroids
    for (let i = 0; i < numZones; i++) {
      if (clusters[i].length > 0) {
        const sumLat = clusters[i].reduce((sum, d) => sum + d.latitude, 0);
        const sumLng = clusters[i].reduce((sum, d) => sum + d.longitude, 0);
        centroids[i] = {
          latitude: sumLat / clusters[i].length,
          longitude: sumLng / clusters[i].length
        };
      }
    }
  }

  // Convert to object format
  const result: Record<number, Delivery[]> = {};
  clusters.forEach((cluster, index) => {
    if (cluster.length > 0) {
      result[index] = cluster;
    }
  });

  return result;
}

function clusterByGrid(deliveries: Delivery[], numZones: number): Record<number, Delivery[]> {
  // Find bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const delivery of deliveries) {
    minLat = Math.min(minLat, delivery.latitude);
    maxLat = Math.max(maxLat, delivery.latitude);
    minLng = Math.min(minLng, delivery.longitude);
    maxLng = Math.max(maxLng, delivery.longitude);
  }

  // Calculate grid dimensions
  const latRatio = (maxLat - minLat) / (maxLng - minLng);
  let gridRows: number, gridCols: number;

  if (latRatio > 1) {
    gridRows = Math.ceil(Math.sqrt(numZones * latRatio));
    gridCols = Math.ceil(numZones / gridRows);
  } else {
    gridCols = Math.ceil(Math.sqrt(numZones / latRatio));
    gridRows = Math.ceil(numZones / gridCols);
  }

  const latStep = (maxLat - minLat) / gridRows;
  const lngStep = (maxLng - minLng) / gridCols;

  // Assign to grid cells
  const grid: Record<number, Delivery[]> = {};

  for (const delivery of deliveries) {
    const row = Math.min(gridRows - 1, Math.floor((delivery.latitude - minLat) / latStep));
    const col = Math.min(gridCols - 1, Math.floor((delivery.longitude - minLng) / lngStep));
    const cellIndex = row * gridCols + col;

    if (!grid[cellIndex]) {
      grid[cellIndex] = [];
    }
    grid[cellIndex].push(delivery);
  }

  return grid;
}

function clusterByProvince(deliveries: Delivery[], maxStoresPerZone: number): Record<number, Delivery[]> {
  // Simple clustering by address similarity
  // In a real implementation, this would use province data
  return clusterByKMeans(deliveries, Math.ceil(deliveries.length / maxStoresPerZone));
}

// Insertion Heuristic Algorithm
export function insertionHeuristic(
  deliveries: Delivery[],
  warehouse: Location,
  settings: any
): Trip[] {
  const trips: Trip[] = [];
  const unassigned = [...deliveries];
  const maxCapacity = settings.vehicleCapacityKg || 1000;
  const maxStops = settings.maxStops || 20;

  // Sort by priority (higher first)
  unassigned.sort((a, b) => (b.priority || 50) - (a.priority || 50));

  while (unassigned.length > 0) {
    const trip: Trip = {
      stops: [],
      totalWeight: 0,
      totalVolume: 0,
      totalDistance: 0
    };

    let capacity = maxCapacity;

    // Add first delivery (furthest or highest priority)
    let bestIndex = 0;
    let bestMetric = -Infinity;

    for (let i = 0; i < unassigned.length; i++) {
      const delivery = unassigned[i];
      const distance = calculateDistance(
        warehouse.latitude,
        warehouse.longitude,
        delivery.latitude,
        delivery.longitude
      );
      const metric = distance * 0.7 + (delivery.priority || 50) * 0.3;
      if (metric > bestMetric) {
        bestMetric = metric;
        bestIndex = i;
      }
    }

    const seedDelivery = unassigned.splice(bestIndex, 1)[0];
    trip.stops.push(seedDelivery);
    trip.totalWeight = seedDelivery.weight;
    capacity -= seedDelivery.weight;

    // Keep inserting deliveries
    while (unassigned.length > 0 && trip.stops.length < maxStops) {
      let bestInsertionIndex = -1;
      let bestDeliveryIndex = -1;
      let bestInsertionCost = Infinity;

      // Try each unassigned delivery
      for (let i = 0; i < unassigned.length; i++) {
        const delivery = unassigned[i];

        // Check capacity
        if (delivery.weight > capacity) continue;

        // Try inserting at each position
        for (let j = 0; j <= trip.stops.length; j++) {
          const prevLoc = j === 0 ? warehouse : trip.stops[j - 1];
          const nextLoc = j === trip.stops.length ? warehouse : trip.stops[j];

          const directCost = calculateDistance(
            prevLoc.latitude,
            prevLoc.longitude,
            nextLoc.latitude,
            nextLoc.longitude
          );

          const insertionCost =
            calculateDistance(prevLoc.latitude, prevLoc.longitude, delivery.latitude, delivery.longitude) +
            calculateDistance(delivery.latitude, delivery.longitude, nextLoc.latitude, nextLoc.longitude) -
            directCost;

          if (insertionCost < bestInsertionCost) {
            bestInsertionCost = insertionCost;
            bestDeliveryIndex = i;
            bestInsertionIndex = j;
          }
        }
      }

      if (bestDeliveryIndex === -1) break;

      const bestDelivery = unassigned.splice(bestDeliveryIndex, 1)[0];
      trip.stops.splice(bestInsertionIndex, 0, bestDelivery);
      trip.totalWeight! += bestDelivery.weight;
      capacity -= bestDelivery.weight;
    }

    // Calculate trip distance
    trip.totalDistance = calculateTripDistance(trip.stops, warehouse);
    trips.push(trip);
  }

  return trips;
}

// Clarke-Wright Savings Algorithm
export function clarkeWrightSavings(
  deliveries: Delivery[],
  warehouse: Location,
  settings: any
): Trip[] {
  const maxCapacity = settings.vehicleCapacityKg || 1000;
  const maxStops = settings.maxStops || 20;

  // Start with each delivery in its own route
  const routes: Trip[] = deliveries.map(delivery => ({
    stops: [delivery],
    totalWeight: delivery.weight,
    totalDistance: calculateDistance(
      warehouse.latitude,
      warehouse.longitude,
      delivery.latitude,
      delivery.longitude
    ) * 2
  }));

  // Calculate savings for each pair
  const savings: Array<{ i: number; j: number; saving: number }> = [];

  for (let i = 0; i < deliveries.length; i++) {
    for (let j = i + 1; j < deliveries.length; j++) {
      const d0i = calculateDistance(
        warehouse.latitude,
        warehouse.longitude,
        deliveries[i].latitude,
        deliveries[i].longitude
      );
      const d0j = calculateDistance(
        warehouse.latitude,
        warehouse.longitude,
        deliveries[j].latitude,
        deliveries[j].longitude
      );
      const dij = calculateDistance(
        deliveries[i].latitude,
        deliveries[i].longitude,
        deliveries[j].latitude,
        deliveries[j].longitude
      );

      const saving = d0i + d0j - dij;
      savings.push({ i, j, saving });
    }
  }

  // Sort savings in descending order
  savings.sort((a, b) => b.saving - a.saving);

  // Merge routes based on savings
  const routeIndices = Array(deliveries.length).fill(0).map((_, i) => i);

  for (const s of savings) {
    const routeI = routeIndices[s.i];
    const routeJ = routeIndices[s.j];

    if (routeI === routeJ) continue;

    const routeIObj = routes[routeI];
    const routeJObj = routes[routeJ];

    const combinedWeight = routeIObj.totalWeight! + routeJObj.totalWeight!;
    const combinedStops = routeIObj.stops.length + routeJObj.stops.length;

    if (combinedWeight > maxCapacity || combinedStops > maxStops) continue;

    // Merge routes
    routeIObj.stops = [...routeIObj.stops, ...routeJObj.stops];
    routeIObj.totalWeight = combinedWeight;
    routeIObj.totalDistance = calculateTripDistance(routeIObj.stops, warehouse);

    // Update indices
    for (let k = 0; k < deliveries.length; k++) {
      if (routeIndices[k] === routeJ) {
        routeIndices[k] = routeI;
      }
    }

    // Clear merged route
    routeJObj.stops = [];
    routeJObj.totalWeight = 0;
  }

  return routes.filter(route => route.stops.length > 0);
}

// Nearest Neighbor Algorithm
export function nearestNeighbor(
  deliveries: Delivery[],
  warehouse: Location,
  settings: any
): Trip[] {
  const trips: Trip[] = [];
  const unassigned = [...deliveries];
  const maxCapacity = settings.vehicleCapacityKg || 1000;
  const maxStops = settings.maxStops || 20;

  while (unassigned.length > 0) {
    const trip: Trip = {
      stops: [],
      totalWeight: 0,
      totalDistance: 0
    };

    let currentLocation = warehouse;
    let capacity = maxCapacity;

    while (unassigned.length > 0 && trip.stops.length < maxStops) {
      let bestIndex = -1;
      let bestDistance = Infinity;

      for (let i = 0; i < unassigned.length; i++) {
        const delivery = unassigned[i];
        if (delivery.weight > capacity) continue;

        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          delivery.latitude,
          delivery.longitude
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) break;

      const bestDelivery = unassigned.splice(bestIndex, 1)[0];
      trip.stops.push(bestDelivery);
      trip.totalWeight! += bestDelivery.weight;
      capacity -= bestDelivery.weight;
      currentLocation = bestDelivery;
    }

    trip.totalDistance = calculateTripDistance(trip.stops, warehouse);
    trips.push(trip);
  }

  return trips;
}

// 2-opt Local Search Optimization
export function localSearch2Opt(
  trips: Trip[],
  warehouse: Location,
  settings: any
): Trip[] {
  return trips.map(trip => {
    if (trip.stops.length <= 3) return trip;

    let improved = true;
    let bestStops = [...trip.stops];
    let bestDistance = calculateTripDistance(bestStops, warehouse);

    while (improved) {
      improved = false;

      for (let i = 0; i < bestStops.length - 1; i++) {
        for (let j = i + 1; j < bestStops.length; j++) {
          // Reverse segment from i to j
          const newStops = [
            ...bestStops.slice(0, i),
            ...bestStops.slice(i, j + 1).reverse(),
            ...bestStops.slice(j + 1)
          ];

          const newDistance = calculateTripDistance(newStops, warehouse);

          if (newDistance < bestDistance) {
            bestStops = newStops;
            bestDistance = newDistance;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return {
      ...trip,
      stops: bestStops,
      totalDistance: bestDistance
    };
  });
}

// Consolidate Routes
export function consolidateRoutes(
  trips: Trip[],
  warehouse: Location,
  settings: any
): Trip[] {
  const maxCapacity = settings.vehicleCapacityKg || 1000;
  const maxStops = settings.maxStops || 20;
  const maxDetourFactor = settings.detourFactor || 1.5;

  let consolidated = [...trips];
  let hasConsolidated = true;
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (hasConsolidated && iterations < MAX_ITERATIONS) {
    hasConsolidated = false;
    iterations++;

    // Sort by load (ascending)
    consolidated.sort((a, b) => (a.totalWeight || 0) - (b.totalWeight || 0));

    for (let i = 0; i < consolidated.length - 1; i++) {
      if ((consolidated[i].totalWeight || 0) > maxCapacity * 0.9) continue;

      for (let j = i + 1; j < consolidated.length; j++) {
        const combinedWeight = (consolidated[i].totalWeight || 0) + (consolidated[j].totalWeight || 0);
        const combinedStops = consolidated[i].stops.length + consolidated[j].stops.length;

        if (combinedWeight > maxCapacity || combinedStops > maxStops) continue;

        const mergedStops = [...consolidated[i].stops, ...consolidated[j].stops];
        const mergedDistance = calculateTripDistance(mergedStops, warehouse);
        const originalDistance = (consolidated[i].totalDistance || 0) + (consolidated[j].totalDistance || 0);

        if (mergedDistance / originalDistance <= maxDetourFactor) {
          consolidated[i].stops = mergedStops;
          consolidated[i].totalWeight = combinedWeight;
          consolidated[i].totalDistance = mergedDistance;
          consolidated.splice(j, 1);
          hasConsolidated = true;
          break;
        }
      }
      if (hasConsolidated) break;
    }
  }

  return consolidated;
}

// Calculate Route Costs
export function calculateRouteCosts(
  trips: Trip[],
  warehouse: Location,
  settings: any
): Trip[] {
  const costPerKm = settings.costPerKm || 5;
  const costPerVehicle = settings.costPerVehicle || 500;
  const driverHourlyRate = settings.driverHourlyRate || 100;
  const avgSpeedKmh = settings.avgSpeedKmh || 40;

  return trips.map(trip => {
    const distance = trip.totalDistance || 0;
    const driveTimeHours = distance / avgSpeedKmh;
    const serviceTimeHours = trip.stops.reduce((sum, stop) => sum + (stop.serviceTime || 15), 0) / 60;
    const totalTimeHours = driveTimeHours + serviceTimeHours;

    const distanceCost = distance * costPerKm;
    const timeCost = totalTimeHours * driverHourlyRate;
    const fixedCost = costPerVehicle;
    const totalCost = distanceCost + timeCost + fixedCost;

    // Calculate estimated arrival times
    let currentTime = parseTime(settings.startTime || '08:00');
    let currentLocation = warehouse;

    const stopsWithTimes = trip.stops.map((stop, index) => {
      const driveTime = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        stop.latitude,
        stop.longitude
      ) / avgSpeedKmh * 60; // minutes

      currentTime += driveTime;
      const arrivalTime = formatTime(currentTime);
      currentTime += stop.serviceTime || 15;
      const departureTime = formatTime(currentTime);
      currentLocation = stop;

      return {
        ...stop,
        estimatedArrival: arrivalTime,
        estimatedDeparture: departureTime,
        distanceFromPrevious: index === 0 
          ? calculateDistance(warehouse.latitude, warehouse.longitude, stop.latitude, stop.longitude)
          : calculateDistance(trip.stops[index - 1].latitude, trip.stops[index - 1].longitude, stop.latitude, stop.longitude),
        driveTimeFromPrevious: driveTime
      };
    });

    return {
      ...trip,
      stops: stopsWithTimes,
      totalDriveTime: driveTimeHours * 60,
      totalServiceTime: serviceTimeHours * 60,
      totalCost: totalCost,
      totalVolume: trip.stops.reduce((sum, stop) => sum + (stop.volume || 0), 0),
      totalPallets: trip.stops.reduce((sum, stop) => sum + (stop.pallets || 0), 0),
      totalUnits: trip.stops.reduce((sum, stop) => sum + (stop.units || 0), 0)
    };
  });
}

// Helper: Calculate trip distance
function calculateTripDistance(stops: any[], warehouse: Location): number {
  if (stops.length === 0) return 0;

  let distance = 0;

  // Warehouse to first stop
  distance += calculateDistance(
    warehouse.latitude,
    warehouse.longitude,
    stops[0].latitude,
    stops[0].longitude
  );

  // Between stops
  for (let i = 0; i < stops.length - 1; i++) {
    distance += calculateDistance(
      stops[i].latitude,
      stops[i].longitude,
      stops[i + 1].latitude,
      stops[i + 1].longitude
    );
  }

  // Last stop back to warehouse
  distance += calculateDistance(
    stops[stops.length - 1].latitude,
    stops[stops.length - 1].longitude,
    warehouse.latitude,
    warehouse.longitude
  );

  return distance;
}

// Helper: Parse time string to minutes
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper: Format minutes to time string
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Reorder stops based on the selected ordering method
 * @param trips - Array of trips with stops
 * @param warehouse - Warehouse location
 * @param method - Ordering method: 'optimized', 'nearest-to-farthest', or 'circular-return'
 * @returns Trips with reordered stops
 */
export function reorderStopsByMethod(trips: Trip[], warehouse: Location, method: string): Trip[] {
  if (!method || method === 'optimized') {
    // Keep the algorithm-optimized order
    return trips;
  }

  return trips.map(trip => {
    if (!trip.stops || trip.stops.length <= 1) {
      return trip;
    }

    let reorderedStops = [...trip.stops];

    if (method === 'nearest-to-farthest') {
      // Sort by distance from warehouse (nearest first, farthest last)
      reorderedStops = reorderedStops.sort((a, b) => {
        const distA = calculateDistance(warehouse.latitude, warehouse.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(warehouse.latitude, warehouse.longitude, b.latitude, b.longitude);
        return distA - distB; // Ascending order (nearest to farthest)
      });
    } else if (method === 'circular-return') {
      // Create a circular route: start with farthest, then work back to nearest
      // This creates a loop that returns to near the warehouse

      // First, sort by distance (farthest to nearest)
      const sortedByDistance = [...reorderedStops].sort((a, b) => {
        const distA = calculateDistance(warehouse.latitude, warehouse.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(warehouse.latitude, warehouse.longitude, b.latitude, b.longitude);
        return distB - distA; // Descending order (farthest first)
      });

      // Build circular route: go to farthest point, then spiral back
      reorderedStops = [];
      const remaining = [...sortedByDistance];

      if (remaining.length > 0) {
        // Start with the farthest point
        let current = remaining.shift()!;
        reorderedStops.push(current);

        // For each remaining stop, find the nearest to current position
        while (remaining.length > 0) {
          let nearestIndex = 0;
          let nearestDistance = calculateDistance(
            current.latitude, current.longitude,
            remaining[0].latitude, remaining[0].longitude
          );

          for (let i = 1; i < remaining.length; i++) {
            const dist = calculateDistance(
              current.latitude, current.longitude,
              remaining[i].latitude, remaining[i].longitude
            );
            if (dist < nearestDistance) {
              nearestDistance = dist;
              nearestIndex = i;
            }
          }

          current = remaining.splice(nearestIndex, 1)[0];
          reorderedStops.push(current);
        }
      }
    }

    // Recalculate distance with new order
    const totalDistance = calculateTripDistance(reorderedStops, warehouse);

    return {
      ...trip,
      stops: reorderedStops,
      totalDistance: totalDistance
    };
  });
}

/**
 * Enforce vehicle limit by consolidating trips if necessary
 * @param trips - Array of trips
 * @param warehouse - Warehouse location
 * @param settings - Optimization settings
 * @returns Trips consolidated to fit within vehicle limit
 */
export function enforceVehicleLimit(trips: Trip[], warehouse: Location, settings: any): Trip[] {
  const maxVehicles = settings.maxVehicles || 0;
  const enforceLimit = settings.enforceVehicleLimit || false;
  const maxCapacity = settings.vehicleCapacityKg || 1000;

  console.log(`[enforceVehicleLimit] Called with:`, {
    tripsCount: trips.length,
    maxVehicles,
    enforceLimit,
    maxCapacity
  });

  // If no limit or not enforcing, return as is
  if (maxVehicles === 0 || !enforceLimit) {
    console.log(`[enforceVehicleLimit] Skipping: maxVehicles=${maxVehicles}, enforceLimit=${enforceLimit}`);
    return trips;
  }

  // If already within limit, return as is
  if (trips.length <= maxVehicles) {
    console.log(`[enforceVehicleLimit] Already within limit: ${trips.length} <= ${maxVehicles}`);
    return trips;
  }

  console.log(`[enforceVehicleLimit] Enforcing vehicle limit: ${trips.length} trips -> max ${maxVehicles} vehicles`);

  // Sort trips by total weight (ascending) to merge lighter trips first
  let consolidated = [...trips].sort((a, b) => (a.totalWeight || 0) - (b.totalWeight || 0));

  // Keep merging until we're within the limit
  while (consolidated.length > maxVehicles) {
    // Find the two trips that would create the smallest combined weight
    let bestI = 0;
    let bestJ = 1;
    let bestCombinedWeight = Infinity;

    for (let i = 0; i < consolidated.length - 1; i++) {
      for (let j = i + 1; j < consolidated.length; j++) {
        const combinedWeight = (consolidated[i].totalWeight || 0) + (consolidated[j].totalWeight || 0);
        if (combinedWeight < bestCombinedWeight) {
          bestCombinedWeight = combinedWeight;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Merge the two best trips
    const mergedStops = [...consolidated[bestI].stops, ...consolidated[bestJ].stops];
    const mergedWeight = (consolidated[bestI].totalWeight || 0) + (consolidated[bestJ].totalWeight || 0);
    const mergedDistance = calculateTripDistance(mergedStops, warehouse);

    // Mark as overweight if exceeds capacity
    const isOverweight = mergedWeight > maxCapacity;

    consolidated[bestI] = {
      ...consolidated[bestI],
      stops: mergedStops,
      totalWeight: mergedWeight,
      totalDistance: mergedDistance,
      isOverweight: isOverweight
    };

    // Remove the merged trip
    consolidated.splice(bestJ, 1);

    console.log(`[enforceVehicleLimit] Merged trips ${bestI} and ${bestJ}: ${mergedWeight.toFixed(1)}kg ${isOverweight ? '(OVERWEIGHT)' : ''}, remaining trips: ${consolidated.length}`);
  }

  console.log(`[enforceVehicleLimit] Final result: ${consolidated.length} trips (target was ${maxVehicles})`);
  return consolidated;
}
