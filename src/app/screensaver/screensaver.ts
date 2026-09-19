import { Component, input, output } from '@angular/core';
import { WeatherSnapshot } from '../core/models';

@Component({
  selector: 'app-screensaver',
  templateUrl: './screensaver.html',
})
export class Screensaver {
  readonly visible = input(false);
  readonly clock = input('');
  readonly weather = input<WeatherSnapshot | null>(null);
  readonly location = input('');
  readonly dismiss = output<void>();
}
