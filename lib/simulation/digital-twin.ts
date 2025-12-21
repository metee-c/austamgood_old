/**
 * Digital Twin Engine
 * 
 * Creates a virtual model of the warehouse that reflects current state
 * and allows running what-if simulations without affecting real data.
 * 
 * Properties validated:
 * - Property 3: Simulation Isolation
 * - Property 10: Simulation Reproducibility
 */

import {
  WarehouseState,
  StorageModel,
  ThroughputModel,
  LaborModel,
  LeadTimeModel,
  OrderPatternModel,
  generateSimulationId,
} from './types';
import { loadStorageModel } from './models/storage-model';
import { loadThroughputModel } from './models/throughput-model';
import { loadLaborModel } from './models/labor-model';
import { loadLeadTimeModel } from './models/leadtime-model';
import { loadOrderPatternModel } from './models/order-pattern-model';

/**
 * Digital Twin class - creates and manages virtual warehouse model
 */
export class DigitalTwin {
  private baseline: WarehouseState | null = null;
  private snapshotId: string = '';
  private snapshotTimestamp: string = '';
  private isInitialized: boolean = false;

  /**
   * Initialize Digital Twin from current database state
   * Creates a read-only snapshot for simulations
   */
  async initialize(periodDays: number = 30): Promise<void> {
    console.log('[DigitalTwin] Initializing from database...');
    
    const timestamp = new Date().toISOString();
    const snapshotId = generateSimulationId();

    try {
      // Load all models in parallel
      const [storage, throughput, labor, leadTime, orderPatterns] = await Promise.all([
        loadStorageModel(),
        loadThroughputModel(periodDays),
        loadLaborModel(periodDays),
        loadLeadTimeModel(periodDays * 3), // Use 3x period for lead time (more data needed)
        loadOrderPatternModel(periodDays * 3),
      ]);

      this.baseline = {
        storage,
        throughput,
        labor,
        leadTime,
        orderPatterns,
        timestamp,
        data_snapshot_id: snapshotId,
      };

      this.snapshotId = snapshotId;
      this.snapshotTimestamp = timestamp;
      this.isInitialized = true;

      console.log('[DigitalTwin] Initialized successfully:', {
        snapshotId,
        timestamp,
        locations: storage.summary.total_locations,
        utilization: storage.summary.utilization_percent,
      });

    } catch (error) {
      console.error('[DigitalTwin] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if Digital Twin is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.baseline !== null;
  }

  /**
   * Get current baseline state (read-only copy)
   * Property 3: Returns deep clone to ensure isolation
   */
  getBaseline(): WarehouseState {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized. Call initialize() first.');
    }
    // Return deep clone to prevent modification
    return JSON.parse(JSON.stringify(this.baseline));
  }

  /**
   * Get snapshot metadata
   */
  getSnapshotInfo(): { id: string; timestamp: string; isInitialized: boolean } {
    return {
      id: this.snapshotId,
      timestamp: this.snapshotTimestamp,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Get storage model
   */
  getStorageModel(): StorageModel {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized');
    }
    return JSON.parse(JSON.stringify(this.baseline.storage));
  }

  /**
   * Get throughput model
   */
  getThroughputModel(): ThroughputModel {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized');
    }
    return JSON.parse(JSON.stringify(this.baseline.throughput));
  }

  /**
   * Get labor model
   */
  getLaborModel(): LaborModel {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized');
    }
    return JSON.parse(JSON.stringify(this.baseline.labor));
  }

  /**
   * Get lead time model
   */
  getLeadTimeModel(): LeadTimeModel {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized');
    }
    return JSON.parse(JSON.stringify(this.baseline.leadTime));
  }

  /**
   * Get order pattern model
   */
  getOrderPatternModel(): OrderPatternModel {
    if (!this.baseline) {
      throw new Error('Digital Twin not initialized');
    }
    return JSON.parse(JSON.stringify(this.baseline.orderPatterns));
  }

  /**
   * Create a modified copy of warehouse state for simulation
   * Property 3: Simulation Isolation - returns new object, doesn't modify baseline
   */
  createSimulatedState(modifications: Partial<WarehouseState>): WarehouseState {
    const baseline = this.getBaseline();
    
    return {
      ...baseline,
      ...modifications,
      timestamp: new Date().toISOString(),
      data_snapshot_id: `${this.snapshotId}_sim`,
    };
  }

  /**
   * Refresh baseline from database
   */
  async refresh(periodDays: number = 30): Promise<void> {
    this.isInitialized = false;
    await this.initialize(periodDays);
  }
}

// Singleton instance for reuse
let digitalTwinInstance: DigitalTwin | null = null;

/**
 * Get or create Digital Twin instance
 */
export async function getDigitalTwin(forceRefresh: boolean = false): Promise<DigitalTwin> {
  if (!digitalTwinInstance || forceRefresh) {
    digitalTwinInstance = new DigitalTwin();
    await digitalTwinInstance.initialize();
  } else if (!digitalTwinInstance.isReady()) {
    await digitalTwinInstance.initialize();
  }
  
  return digitalTwinInstance;
}

/**
 * Create a fresh Digital Twin instance (not singleton)
 */
export async function createDigitalTwin(periodDays: number = 30): Promise<DigitalTwin> {
  const twin = new DigitalTwin();
  await twin.initialize(periodDays);
  return twin;
}
