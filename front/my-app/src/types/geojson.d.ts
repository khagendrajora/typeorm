declare module "*.geojson?url" {
  const value: string;
  export default value;
}

declare module "*.geojson" {
  const value: any;
  export default value;
}
