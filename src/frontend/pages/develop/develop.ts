import { apiForm } from "../../api";

export const rows = (d: any): any[] => Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : Array.isArray(d?.items) ? d.items : [];

export const postForm = apiForm;

export const placeIcon = (p: any) => p?.icon || "/img/DefaultPlaceIcon.jpg";

export const priceText = (price: any) => price === null || price === undefined || price === "" ? "Off Sale" : Number(price) === 0 ? "Free" : `${Number(price).toLocaleString()} Nonebux`;
