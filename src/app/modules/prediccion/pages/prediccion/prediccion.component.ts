import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, OnDestroy} from '@angular/core'
import { CommonModule } from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormGroup, FormControl} from '@angular/forms';
import {HistoricalData, PredictionResult, PredictionService} from "../../services/prediction.service";
import {debounceTime, distinctUntilChanged, Subject} from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import {Chart, ChartConfiguration, ChartData, ChartType, registerables, TooltipItem} from 'chart.js';
import { WasteAnalysisData, WasteMonthData } from "../../services/prediction.service";


import {RouterLink} from "@angular/router";


interface MonthOption {
  name: string;
  value: string;
}

@Component({
  selector: 'app-prediccion',
  templateUrl: './prediccion.component.html',
  styleUrls: ['./prediccion.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    BaseChartDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class PrediccionComponent implements OnInit, OnDestroy {
  @ViewChild('wasteChart') wasteChart!: BaseChartDirective;
  @ViewChild(BaseChartDirective) chart!: BaseChartDirective;
  private destroy$ = new Subject<void>();

  // Propiedades comunes para el grafico
  availableMonths: MonthOption[] = [];
  isLoading = true;
  hasSufficientData = false;
  isPredicting = false;
  predictionResult: PredictionResult | null = null;
  predictionForm: FormGroup;



  // Propiedades del gráfico 1
  performanceFilterForm: FormGroup;
  performanceStartMonths: MonthOption[] = [];
  performanceEndMonths: MonthOption[] = [];
  historicalData: HistoricalData = { meses: [], promedioCompras: 0, promedioConsumo: 0 };
  selectedMonthData = { compras: 0, consumo: 0 };
  comparisonMonthControl = new FormControl<string | null>(null);

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (value) => `S/ ${value}` } } },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'center',
        labels: {
          boxWidth: 20,
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) { label += ': '; }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Compras reales', backgroundColor: '#ff9f40', borderRadius: 4 },
      { data: [], label: 'Consumo estimado', backgroundColor: '#77dd77', borderRadius: 4 }
    ]
  };


  // Propiedades del gráfico 2
  wasteFilterForm: FormGroup;
  wasteStartMonths: MonthOption[] = [];
  wasteEndMonths: MonthOption[] = [];
  wasteAnalysisData: WasteAnalysisData | null = null;
  selectedWasteMonthData: Partial<WasteMonthData> = {};
  wasteComparisonControl = new FormControl<string | null>(null)

  public wasteChartOptions: ChartConfiguration<'bar' | 'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {},
      y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Kilogramos (Kg)' } },
      y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Desperdicio (%)' }, min: 0, ticks: { callback: (value) => `${Number(value).toFixed(1)}%` } }
    },
    plugins: {
      legend: { position: 'top', align: 'center' },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<any>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (context.dataset.yAxisID === 'y1') return ` ${label}: ${value.toFixed(2)}%`;
            return ` ${label}: ${value.toFixed(2)} Kg`;
          }
        }
      }
    }
  };
  public wasteChartData: ChartData<'bar' | 'line'> = {
    labels: [],
    datasets: [
      { type: 'bar', label: 'Comprado (Kg)', data: [], backgroundColor: 'rgba(255, 159, 64, 0.7)' },
      { type: 'bar', label: 'Consumido (Kg)', data: [], backgroundColor: 'rgba(119, 221, 119, 0.7)' },
      { type: 'line', label: '% Desperdicio', data: [], yAxisID: 'y1', borderColor: '#dc3545', pointBackgroundColor: '#dc3545', tension: 0.1, fill: false }
    ]
  };


  constructor(
      private fb: FormBuilder,
      private predictionService: PredictionService,
      private cdr: ChangeDetectorRef
  ) {
    Chart.register(...registerables);

    this.performanceFilterForm = this.fb.group({
      startMonth: [null],
      endMonth: [null]
    });


    this.wasteFilterForm = this.fb.group({
      startMonth: [null],
      endMonth: [null]
    });

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 7);
    this.predictionForm = this.fb.group({
      fechaInicio: [this.formatDate(today)],
      fechaFin: [this.formatDate(futureDate)]
    });
  }

  ngOnInit(): void {
    this.predictionService.checkDataAvailability().pipe(takeUntil(this.destroy$)).subscribe(hasData => {
      this.hasSufficientData = hasData;
      this.isLoading = false;

      if (hasData) {
        this.predictionService.getAvailableMonths().pipe(takeUntil(this.destroy$)).subscribe(months => {
          this.availableMonths = months;
          this.performanceStartMonths = [...months];
          this.performanceEndMonths = [...months];
          this.wasteStartMonths = [...months];
          this.wasteEndMonths = [...months];

          this.setupFilterListeners();
          this.listenToManualComparisonChanges();

          this.setDefaultDateFilters(months);
        });
      }
      this.cdr.markForCheck();
    });
  }

  setupFilterListeners(): void {
    // Listener para el formulario de DESEMPEÑO
    this.performanceFilterForm.valueChanges.pipe(
        debounceTime(50), // Un debounce pequeño para evitar ejecuciones múltiples
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        takeUntil(this.destroy$)
    ).subscribe(values => {
      this.performanceEndMonths = this.availableMonths.filter(m => m.value >= values.startMonth);
      this.performanceStartMonths = this.availableMonths.filter(m => m.value <= values.endMonth);

      if (values.startMonth && values.endMonth && values.startMonth <= values.endMonth) {
        this.loadPerformanceData();
      }
      this.cdr.markForCheck();
    });

    // Listener para el formulario de DESPERDICIO
    this.wasteFilterForm.valueChanges.pipe(
        debounceTime(50),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        takeUntil(this.destroy$)
    ).subscribe(values => {
      this.wasteEndMonths = this.availableMonths.filter(m => m.value >= values.startMonth);
      this.wasteStartMonths = this.availableMonths.filter(m => m.value <= values.endMonth);

      if (values.startMonth && values.endMonth && values.startMonth <= values.endMonth) {
        this.loadWasteData();
      }
      this.cdr.markForCheck();
    });
  }

  setDefaultDateFilters(months: MonthOption[]): void {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthIndex = months.findIndex(m => m.value === currentMonthKey);

    let endIndex = months.length > 0 ? months.length - 1 : 0;
    if (currentMonthIndex !== -1) {
      endIndex = currentMonthIndex;
    }
    const startIndex = Math.max(0, endIndex - 3);
    const defaultStartMonth = months[startIndex]?.value || null;
    const defaultEndMonth = months[endIndex]?.value || null;

    this.performanceFilterForm.setValue({ startMonth: defaultStartMonth, endMonth: defaultEndMonth });
    this.wasteFilterForm.setValue({ startMonth: defaultStartMonth, endMonth: defaultEndMonth });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  // MÉTODOS DE LÓGICA

  private listenToManualComparisonChanges(): void {
    this.comparisonMonthControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(key => {
      if (key) {
        this.selectedMonthData = this.historicalData.meses.find(m => m.key === key) || { compras: 0, consumo: 0 };
        this.cdr.markForCheck();
      }
    });

    this.wasteComparisonControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(key => {
      if (key && this.wasteAnalysisData) {
        this.selectedWasteMonthData = this.wasteAnalysisData.meses.find(m => m.key === key) || {};
        this.cdr.markForCheck();
      }
    });
  }


  loadPerformanceData(): void {
    const { startMonth, endMonth } = this.performanceFilterForm.value;
    if (!startMonth || !endMonth || startMonth > endMonth) return;

    this.predictionService.getHistoricalPerformance(startMonth, endMonth)
        .pipe(takeUntil(this.destroy$)).subscribe(performance => {
      this.historicalData = performance;

      // Actualización del gráfico 1
      this.barChartData.labels = performance.meses.map(m => m.mes);
      this.barChartData.datasets[0].data = performance.meses.map(m => m.compras);
      this.barChartData.datasets[1].data = performance.meses.map(m => m.consumo);

      const lastKey = performance.meses.length > 0 ? performance.meses[performance.meses.length - 1].key : null;
      this.comparisonMonthControl.setValue(lastKey, { emitEvent: false });
      this.selectedMonthData = performance.meses.find(m => m.key === lastKey) || { compras: 0, consumo: 0 };

      this.chart?.update();
      this.cdr.markForCheck();
    });
  }

  loadWasteData(): void {
    const { startMonth, endMonth } = this.wasteFilterForm.value;
    if (!startMonth || !endMonth) return;

    this.predictionService.getWasteAnalysisData(startMonth, endMonth)
        .pipe(takeUntil(this.destroy$)).subscribe(waste => {

      this.wasteAnalysisData = waste;

      const newLabels = waste.meses.map(m => m.mes);
      const newDatasets = [
        { ...this.wasteChartData.datasets[0], data: waste.meses.map(m => m.compradoKg) },
        { ...this.wasteChartData.datasets[1], data: waste.meses.map(m => m.consumidoKg) },
        { ...this.wasteChartData.datasets[2], data: waste.meses.map(m => m.porcentajeDesperdicio) }
      ];

      this.wasteChartData = {
        ...this.wasteChartData,
        labels: newLabels,
        datasets: newDatasets
      };

      const lastKey = waste.meses.length > 0 ? waste.meses[waste.meses.length - 1].key : null;
      this.wasteComparisonControl.setValue(lastKey, { emitEvent: false });
      this.selectedWasteMonthData = waste.meses.find(m => m.key === lastKey) || {};

      this.cdr.markForCheck();
    });
  }


  getChartWidth(): number {
    const numMonths = this.barChartData.labels?.length || 0;
    if (numMonths <= 4) {
      return 0;
    }
    const baseWidth = 100;
    const extraWidthPerMonth = 25;
    return baseWidth + (numMonths - 4) * extraWidthPerMonth;
  }
  onGeneratePrediction(): void {
    if (this.predictionForm.invalid) return;
    this.isPredicting = true;
    this.predictionResult = null;
    const { fechaInicio, fechaFin } = this.predictionForm.value;
    this.predictionService.getPrediction(fechaInicio, fechaFin).subscribe({
      next: (result) => {
        this.predictionResult = result;
        this.isPredicting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Error en la predicción:", err);
        this.isPredicting = false;
        this.cdr.markForCheck();
      }
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
