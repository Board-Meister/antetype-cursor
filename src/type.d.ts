import { IIterableWeakMap } from "@src/IterableWeakMap";
import type { IBaseDef, ICore, Layout, Modules } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace";

export interface PositionEvent {
  x: number;
  y: number;
}

export interface CalcEvent {
  values: Record<string, number>;
}

export interface IResizedEvent {
  layout: Layout;
  success: boolean;
}

export type ResizedEvent = CustomEvent<IResizedEvent>;

export enum Event {
  CALC = 'antetype.cursor.calc',
  POSITION = 'antetype.cursor.position',
  DOWN = 'antetype.cursor.on.down',
  UP = 'antetype.cursor.on.up',
  MOVE = 'antetype.cursor.on.move',
  SLIP = 'antetype.cursor.on.slip',
  RESIZED = 'antetype.cursor.on.resized',
}

export interface ICursor {
  selected: IIterableWeakMap<IBaseDef, true>;
  showSelected: () => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false;
  drawSelection: (layer: IBaseDef) => void,
  resetSeeThroughStackMap: VoidFunction;
}

export interface ICursorParams {
  canvas: HTMLCanvasElement|null,
  modules: IRequiredModules,
  herald: Herald,
}

export interface ICursorSettings {
  draw?: {
    disabled?: boolean;
  }
  select?: {
    disabled?: boolean;
  }
  detect?: {
    disabled?: boolean;
  }
  resize?: {
    disabled?: boolean;
    buffer?: number;
  }
  delete?: {
    disabled?: boolean;
  }
}

export const selectionType = 'selection';

export interface ISelectionDef extends IBaseDef {
  type: 'selection',
  selection: {
    layer: IBaseDef;
  }
}

export interface IEventDown {
  x: number;
  y: number;
  layers: Layout;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface IEventHover {
  layer: IBaseDef|null;
  deep: IBaseDef|null;
  x: number;
  y: number;
  // Movement
  mY: number;
  mX: number;
}

export interface IEvent {
  isDown: boolean;
  wasMoved: boolean;
  selected: Selected;
  down: IEventDown;
  hover: IEventHover;
}

export interface BaseEvent {
  origin: MouseEvent;
  target: IEvent;
}

export type DownEvent = BaseEvent;
export type UpEvent = BaseEvent;
export type MoveEvent = BaseEvent;
export interface SlipEvent extends BaseEvent {
  from: IBaseDef|null;
  to: IBaseDef|null;
}

export interface IRequiredModules extends Modules {
  core: ICore;
  workspace?: IWorkspace;
}