import { useEffect, useRef, useState } from "react";
import "./App.css";
import { loadGoogleMaps } from "./google-map-loader";

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const mapsApi = useRef<any>(null);

  // const [button, setButton] = useState<"start" | "end" | "">("");
  // const buttonRef = useRef(button);

  // const [startPoint, setStartPoint] = useState<any>(null);
  // const [endPoint, setEndPoint] = useState<any>(null);

  // const startMarkerRef = useRef<any>(null);
  // const endMarkerRef = useRef<any>(null);

  const routePolylineRef = useRef<any>(null);

  const [markers, setMarkers] = useState([
    {
      coords: { lat: 27.696354, lng: 85.336537 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 1",
    },
    {
      coords: { lat: 27.696662677926415, lng: 85.33526643980764 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 2",
    },
    {
      coords: { lat: 27.696865502368286, lng: 85.33607831974011 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 3",
    },
  ]);

  const [checkPoints, setCheckPoints] = useState<any>([]);
  const markersRef = useRef<any[]>([]);

  // useEffect(() => {
  //   buttonRef.current = button;
  // }, [button]);

  useEffect(() => {
    loadGoogleMaps("AIzaSyBQkos0nrQdixBBmGf06TBjXgjtFcShzzU").then((maps) => {
      mapsApi.current = maps;
      mapInstance.current = new maps.Map(mapRef.current!, {
        center: { lat: 28.90258, lng: 80.34553 },
        zoom: 18,
      });

      markers.forEach((m) => {
        new maps.Marker({
          position: m.coords,
          map: mapInstance.current,
          icon: m.IconImage,
          title: m.title,
        });
      });

      addClickListener();
    });
  }, []);

  const addClickListener = () => {
    // const placeStartMarker = (coords: any) => {
    //   if (startMarkerRef.current) startMarkerRef.current.setMap(null);

    //   startMarkerRef.current = new mapsApi.current.Marker({
    //     position: coords,
    //     map: mapInstance.current!,
    //     icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    //     title: "Start Point",
    //   });
    // };

    // const placeEndMarker = (coords: any) => {
    //   if (endMarkerRef.current) endMarkerRef.current.setMap(null);

    //   endMarkerRef.current = new mapsApi.current.Marker({
    //     position: coords,
    //     map: mapInstance.current!,
    //     icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
    //     title: "End Point",
    //   });
    // };

    mapInstance.current.addListener("click", (event: any) => {
      const pos = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };

      setCheckPoints((prev: any) => {
        const newPoints = [...prev, pos];

        // Add marker for each click
        const marker = new mapsApi.current.Marker({
          position: pos,
          map: mapInstance.current,
          label: `${newPoints.length}`,
        });

        marker.addListener("click", () => {
          removePoint(marker, pos);
        });

        markersRef.current.push(marker);

        return newPoints;
      });
    });
  };

  const removePoint = (marker: any, point: any) => {
    // Remove marker from map
    marker.setMap(null);

    // Remove marker from markersRef
    markersRef.current = markersRef.current.filter((m) => m !== marker);

    // Remove point from checkPoints
    setCheckPoints((prev: any) =>
      prev.filter((p: any) => p.lat !== point.lat || p.lng !== point.lng)
    );

    // Redraw route after removal
    if (checkPoints.length > 1) {
      handleCalculate(true); // recalc without alert
    } else if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
  };

  const handleCalculate = async (silent = false) => {
    if (checkPoints.length < 2) {
      alert("Please select at least 2 points!");
      return;
    }

    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";

    const waypointsString = checkPoints
      .map((p: any) => `${p.lat},${p.lng}`)
      .join("|");

    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsString}&mode=drive&apiKey=${apiKey}`;

    // const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lng}|${end.lat},${end.lng}&mode=drive&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);

      const legs = data.features[0].properties.legs;

      let totalDistance = 0;
      let totalTime = 0;

      legs.forEach((l: any) => {
        totalDistance += l.distance;
        totalTime += l.time;
      });

      alert(`Distance: ${totalDistance} m\nDuration: ${totalTime} seconds`);

      // if (!silent)
      //   alert(
      //     `Distance: ${totalDistance} m\nDuration: ${totalTime.toFixed(
      //       2
      //     )} seconds`
      //   );

      drawRoute(data);
    } catch (error: any) {
      alert("Failed to Calculate");
      console.log(error);
    }
  };

  const drawRoute = (data: any) => {
    const coordsArray = data?.features?.[0]?.geometry?.coordinates;

    if (!data.features || !data.features[0]?.geometry?.coordinates) {
      alert("No route found");
      return;
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }

    // let coordsArray = data.features[0].geometry.coordinates;

    let path: { lat: number; lng: number }[] = [];

    // coordsArray.forEach((segment: any) => {
    //   segment.forEach((c: any) => {
    //     path.push({
    //       lat: Number(c[1]),
    //       lng: Number(c[0]),
    //     });
    //   });
    // });

    if (coordsArray && coordsArray.length > 0) {
      coordsArray.forEach((segment: any) => {
        if (segment.length === 0) return;
        segment.forEach((c: any) => {
          path.push({ lat: Number(c[1]), lng: Number(c[0]) });
        });
      });
      // } else if (checkPoints.length > 1) {
      //   checkPoints.map((p: any) => {
      //     path.push({ lat: p.lat, lng: p.lng });
      //   });
    }
    if (path.length === 0 && checkPoints.length > 1) {
      checkPoints.forEach((p: any) => {
        path.push({ lat: p.lat, lng: p.lng });
      });
    }

    if (path.length === 0) {
      alert("No valid route coordinates");
      return;
    }

    console.log("Path", path);
    // Draw Polyline
    routePolylineRef.current = new mapsApi.current.Polyline({
      path,
      map: mapInstance.current,
      strokeColor: "#007bff",
      strokeWeight: 6,
    });

    // Fit view to route
    const bounds = new mapsApi.current.LatLngBounds();
    path.forEach((p: any) => bounds.extend(p));
    mapInstance.current.fitBounds(bounds);
  };

  const highlightMidpoint = (leg: any) => {
    const steps = leg.steps;
    let total = 0;
    const half = leg.distance.value / 2;

    for (let step of steps) {
      total += step.distance.value;

      if (total >= half) {
        const pos = step.end_location;

        new mapsApi.current.Marker({
          position: pos,
          map: mapInstance.current,
          label: "M",
        });

        break;
      }
    }
  };
  //

  console.log(checkPoints);

  const reset = () => {
    setCheckPoints([]);

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
  };

  return (
    <>
      <div ref={mapRef} style={{ width: "80%", height: "80vh" }} />

      <div className="" style={{ gap: "10px" }}>
        <button
          onClick={() => handleCalculate()}
          style={{ padding: "10px", margin: "5px" }}
        >
          Calculate
        </button>

        <button onClick={reset} style={{ padding: "10px", margin: "5px" }}>
          Reset
        </button>
      </div>
    </>
  );
}

export default App;
